using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.API.Hubs;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Entities;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrderController> _logger;
    private readonly IHubContext<KitchenHub> _kitchenHub;
    private readonly IHubContext<OrderHub> _orderHub;
    private readonly ApplicationDbContext _context;
    private readonly SmartMenu.Application.Services.IAuditService _audit;

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, SemaphoreSlim> _tableOrderLocks = new();

    public OrderController(IOrderService orderService, ILogger<OrderController> logger, IHubContext<KitchenHub> kitchenHub, IHubContext<OrderHub> orderHub, ApplicationDbContext context, SmartMenu.Application.Services.IAuditService audit)
    {
        _orderService = orderService;
        _logger = logger;
        _kitchenHub = kitchenHub;
        _orderHub = orderHub;
        _context = context;
        _audit = audit;
    }

    private (int userId, string authMethod) GetActorFromJwt()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(sub, out var uid);
        var method = User.FindFirst("auth_method")?.Value ?? "password";
        return (uid, method);
    }

    private async Task NotifyWaiterAsync(OrderDto order, string eventName, object payload)
    {
        try
        {
            if (order.AssignedWaiterId.HasValue)
                await _orderHub.Clients.Group($"waiter_{order.AssignedWaiterId.Value}").SendAsync(eventName, payload);
            else
                await _orderHub.Clients.All.SendAsync(eventName, payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo enviar notificación {Event} para orden {OrderId}", eventName, order.Id);
        }
    }

    private async Task NotifyKitchenAsync(OrderDto order)
    {
        try
        {
            var items = order.Items?.Select(i => new { i.Id, i.DishName, i.Quantity, i.Notes }).ToList<object>() ?? new List<object>();
            await _kitchenHub.Clients.Group("kitchen").SendAsync("NewKitchenOrder", new
            {
                orderId = order.Id,
                orderNumber = order.OrderNumber,
                items,
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo notificar a cocina para orden {OrderId}", order.Id);
        }
    }

    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<OrderDto>> CreateOrder([FromBody] CreateOrderDto request)
    {

        if (!request.TableId.HasValue)
            return await CreateFreshOrderAsync(request);

        if (request.IsTakeaway)
            return await CreateFreshOrderAsync(request);

        var gate = _tableOrderLocks.GetOrAdd(request.TableId.Value, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            var activeOrderId = await _orderService.GetActiveOrderIdForTableAsync(request.TableId.Value);
            return activeOrderId.HasValue
                ? await AppendToTableOrderAsync(activeOrderId.Value, request)
                : await CreateFreshOrderAsync(request);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<ActionResult<OrderDto>> CreateFreshOrderAsync(CreateOrderDto request)
    {
        try
        {
            var order = await _orderService.CreateOrderAsync(request);

            var (userId, authMethod) = GetActorFromJwt();
            await _audit.LogAsync(
                userId: userId,
                action: "Order.Created",
                entityType: "Order",
                entityId: order.Id,
                ip: HttpContext.Connection.RemoteIpAddress?.ToString(),
                authMethod: authMethod,
                metadata: new {
                    tableId = order.TableId,
                    total = order.Total,
                    itemsCount = order.Items?.Count ?? 0,
                    assignedWaiterId = order.AssignedWaiterId
                });

            return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Error creating order (DB)");
            return BadRequest(new { error = "No se pudo crear la orden. Intenta de nuevo." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating order");
            return BadRequest(new { error = "No se pudo crear la orden. Intenta de nuevo." });
        }
    }

    private async Task<ActionResult<OrderDto>> AppendToTableOrderAsync(int orderId, CreateOrderDto request)
    {
        try
        {
            var order = await _orderService.AddItemsToOrderAsync(orderId, request.Items, request.CustomerName);
            var who = string.IsNullOrWhiteSpace(request.CustomerName) ? "Un comensal" : request.CustomerName!.Trim();

            await NotifyWaiterAsync(order, "ItemsAddedToOrder", new
            {
                orderId      = order.Id,
                orderNumber  = order.OrderNumber,
                tableNumber  = order.TableNumber,
                customerName = request.CustomerName,
                itemCount    = request.Items.Count,
                message      = $"➕ {who} agregó {request.Items.Count} ítem(s) a la mesa {order.TableNumber}",
                timestamp    = DateTime.UtcNow
            });

            if (!string.Equals(order.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            {
                var newItemsPayload = request.Items.Select(i => new
                {
                    dishId       = i.DishId,
                    dishName     = order.Items?.FirstOrDefault(oi => oi.DishId == i.DishId)?.DishName ?? "Plato",
                    quantity     = i.Quantity,
                    notes        = i.Notes,
                    customerName = request.CustomerName,
                }).ToList<object>();

                try
                {
                    await _kitchenHub.Clients.Group("kitchen").SendAsync("NewKitchenOrder", new
                    {
                        orderId     = order.Id,
                        orderNumber = order.OrderNumber,
                        tableNumber = order.TableNumber,
                        items       = newItemsPayload,
                        isAddition  = true,
                        timestamp   = DateTime.UtcNow
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo notificar a cocina por adición a la orden {OrderId}", order.Id);
                }
            }

            var (userId, authMethod) = GetActorFromJwt();
            await _audit.LogAsync(
                userId: userId,
                action: "Order.ItemsAppended",
                entityType: "Order",
                entityId: order.Id,
                ip: HttpContext.Connection.RemoteIpAddress?.ToString(),
                authMethod: authMethod,
                metadata: new {
                    tableId      = order.TableId,
                    customerName = request.CustomerName,
                    addedCount   = request.Items.Count,
                    total        = order.Total
                });

            return Ok(order);
        }
        catch (KeyNotFoundException)
        {

            return await CreateFreshOrderAsync(request);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error appending items to table order {OrderId}", orderId);
            return BadRequest(new { error = "No se pudieron agregar los ítems. Intenta de nuevo." });
        }
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderDto>> GetOrder(int id)
    {
        var order = await _orderService.GetOrderByIdAsync(id);
        if (order == null)
            return NotFound(new { message = "Orden no encontrada" });

        if (!CanAccessOrder(order))
            return Forbid();

        return Ok(order);
    }

    private bool CanAccessOrder(OrderDto order)
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        if (role != "Waiter") return true;

        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(sub, out var userId)) return false;

        return order.AssignedWaiterId == null || order.AssignedWaiterId == userId;
    }

    [HttpGet("all")]
    [ProducesResponseType(typeof(List<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(PagedResult<OrderDto>), StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,Manager,Waiter,Cashier,Host,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> GetAllOrders([FromQuery] int? page, [FromQuery] int pageSize = 50)
    {
        if (page is null)
        {
            var orders = await _orderService.GetAllOrdersAsync();
            return Ok(orders);
        }

        var paged = await _orderService.GetAllOrdersPagedAsync(page.Value, pageSize);
        return Ok(paged);
    }

    [HttpGet("active")]
    [ProducesResponseType(typeof(List<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(PagedResult<OrderDto>), StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,Manager,Waiter,Cashier,Host,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> GetActiveOrders([FromQuery] int? page, [FromQuery] int pageSize = 50)
    {
        if (page is null)
        {
            var orders = await _orderService.GetActiveOrdersAsync();
            return Ok(orders);
        }
        var paged = await _orderService.GetActiveOrdersPagedAsync(page.Value, pageSize);
        return Ok(paged);
    }

    [HttpPost("{id}/cancel")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelOrder(int id, [FromBody] CancelOrderDto? dto)
    {
        try
        {
            var current = await _orderService.GetOrderByIdAsync(id);
            if (current == null) return NotFound(new { error = "Orden no encontrada" });
            if (!CanAccessOrder(current)) return Forbid();

            var order = await _orderService.CancelOrderAsync(id, dto?.Reason ?? "");
            await NotifyKitchenAsync(order);
            await NotifyWaiterAsync(order, "OrderCancelled", new
            {
                orderId = order.Id,
                orderNumber = order.OrderNumber,
                tableNumber = order.TableNumber,
                reason = dto?.Reason,
                timestamp = DateTime.UtcNow
            });
            return Ok(new { message = "Orden cancelada", order });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPut("{id}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [Authorize(Roles = "Admin,Manager,Waiter,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusDto request)
    {
        try
        {
            var current = await _orderService.GetOrderByIdAsync(id);
            if (current == null)
                return NotFound(new { error = "Orden no encontrada" });
            if (!CanAccessOrder(current))
                return Forbid();

            var role = User.FindFirstValue(ClaimTypes.Role) ?? "";
            var isAdmin = role == "Admin" || role == "Manager";

            var order = await _orderService.UpdateOrderStatusAsync(id, request.NewStatus, isAdmin, request.OverrideReason);
            if (string.Equals(request.NewStatus, "Confirmed", StringComparison.OrdinalIgnoreCase))
                await NotifyKitchenAsync(order);
            return Ok(new { message = "Estado actualizado correctamente", order });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating order status");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id}/kitchen-preparing")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,Manager,Waiter,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> SetKitchenPreparing(int id)
    {
        try
        {
            var order = await _orderService.SetKitchenPreparingAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error kitchen preparing"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/kitchen-ready")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,Manager,Waiter,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> SetKitchenReady(int id)
    {
        try
        {
            var order = await _orderService.SetKitchenReadyAsync(id);
            await NotifyWaiterAsync(order, "OrderReadyForService", new
            {
                orderId = order.Id,
                orderNumber = order.OrderNumber,
                tableNumber = order.TableNumber,
                type = "kitchen",
                message = $"🍽️ Orden #{order.OrderNumber} lista para servir (cocina)",
                timestamp = DateTime.UtcNow
            });
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error kitchen ready"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/bar-preparing")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,Manager,Waiter,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> SetBarPreparing(int id)
    {
        try
        {
            var order = await _orderService.SetBarPreparingAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error bar preparing"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/bar-ready")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,Manager,Waiter,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> SetBarReady(int id)
    {
        try
        {
            var order = await _orderService.SetBarReadyAsync(id);
            await NotifyWaiterAsync(order, "OrderReadyForService", new
            {
                orderId = order.Id,
                orderNumber = order.OrderNumber,
                tableNumber = order.TableNumber,
                type = "bar",
                message = $"🍹 Orden #{order.OrderNumber} lista para servir (bar)",
                timestamp = DateTime.UtcNow
            });
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error bar ready"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/kitchen-served")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> SetKitchenServed(int id)
    {
        try
        {
            var order = await _orderService.SetKitchenServedAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error kitchen served"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/bar-served")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> SetBarServed(int id)
    {
        try
        {
            var order = await _orderService.SetBarServedAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error bar served"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/kitchen-dispatch")]
    [Authorize(Roles = "Admin,Manager,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> KitchenDispatch(int id)
    {
        try
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound(new { error = "Orden no encontrada" });
            if (!order.IsPickup)
                return BadRequest(new { error = "Solo pedidos para llevar/portal se despachan desde el KDS; los de mesa los sirve el mesero." });
            var result = await _orderService.SetKitchenServedAsync(id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error kitchen dispatch"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/bar-dispatch")]
    [Authorize(Roles = "Admin,Manager,Chef,KitchenStaff,Bartender")]
    public async Task<IActionResult> BarDispatch(int id)
    {
        try
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound(new { error = "Orden no encontrada" });
            if (!order.IsPickup)
                return BadRequest(new { error = "Solo pedidos para llevar/portal se despachan desde el KDS; los de mesa los sirve el mesero." });
            var result = await _orderService.SetBarServedAsync(id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error bar dispatch"); return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id}/customer-finished")]
    [AllowAnonymous]
    public async Task<IActionResult> MarkCustomerFinished(int id)
    {
        try
        {
            var order = await _orderService.GetOrderByIdAsync(id);
            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });

            await _orderService.MarkCustomerFinishedAsync(id);
            await NotifyWaiterAsync(order, "CustomerFinished", new
            {
                orderId = order.Id,
                orderNumber = order.OrderNumber,
                tableNumber = order.TableNumber,
                message = $"✅ Mesa {order.TableNumber} terminó de comer",
                timestamp = DateTime.UtcNow
            });
            return Ok(new { message = "Cliente marcado como terminado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking customer finished");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id}/assign-waiter/{waiterId}")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> AssignWaiterToOrder(int id, int waiterId)
    {
        try
        {
            await _orderService.AssignWaiterAsync(id, waiterId);
            var order = await _orderService.GetOrderByIdAsync(id);
            if (order != null)
                await NotifyKitchenAsync(order);
            return Ok(new { message = "Mesero asignado exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning waiter");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id}/unassign-waiter")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> UnassignWaiterFromOrder(int id)
    {
        try
        {
            await _orderService.UnassignWaiterAsync(id);
            return Ok(new { message = "Mesa abandonada correctamente" });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("unassigned")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> GetUnassignedOrders([FromQuery] int? page, [FromQuery] int pageSize = 50)
    {
        try
        {
            if (page is null)
                return Ok(await _orderService.GetUnassignedOrdersAsync());
            return Ok(await _orderService.GetUnassignedOrdersPagedAsync(page.Value, pageSize));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unassigned orders");
            return StatusCode(500, new { error = "Error al obtener órdenes" });
        }
    }

    [HttpGet("my-orders/{waiterId}")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> GetWaiterOrders(int waiterId, [FromQuery] int? page, [FromQuery] int pageSize = 50)
    {
        try
        {
            if (page is null)
                return Ok(await _orderService.GetOrdersByWaiterAsync(waiterId));
            return Ok(await _orderService.GetOrdersByWaiterPagedAsync(waiterId, page.Value, pageSize));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting waiter orders");
            return StatusCode(500, new { error = "Error al obtener órdenes" });
        }
    }

    [HttpPost("{id}/add-items")]
    [AllowAnonymous]
    public async Task<IActionResult> AddItemsToOrder(int id, [FromBody] List<CreateOrderItemDto> items)
    {
        try
        {
            var order = await _orderService.AddItemsToOrderAsync(id, items);

            await NotifyWaiterAsync(order, "ItemsAddedToOrder", new
            {
                orderId     = order.Id,
                orderNumber = order.OrderNumber,
                tableNumber = order.TableNumber,
                itemCount   = items.Count,
                message     = $"➕ Mesa {order.TableNumber} agregó {items.Count} ítem(s) a la orden #{order.OrderNumber}",
                timestamp   = DateTime.UtcNow
            });

            var newItemsPayload = items.Select(i => new
            {
                dishId   = i.DishId,
                dishName = order.Items?.FirstOrDefault(oi => oi.DishId == i.DishId)?.DishName ?? "Plato",
                quantity = i.Quantity,
                notes    = i.Notes,
            }).ToList<object>();

            try
            {
                await _kitchenHub.Clients.Group("kitchen").SendAsync("NewKitchenOrder", new
                {
                    orderId     = order.Id,
                    orderNumber = order.OrderNumber,
                    tableNumber = order.TableNumber,
                    items       = newItemsPayload,
                    isAddition  = true,
                    timestamp   = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo notificar a cocina por adición de ítems en orden {OrderId}", order.Id);
            }

            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding items to order");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("pos")]
    [Authorize(Roles = "Admin,Manager,Cashier")]
    public async Task<IActionResult> CreatePosOrder([FromBody] CreatePosOrderDto dto)
    {
        try
        {

            var (posActorId, _) = GetActorFromJwt();
            if (!(User.IsInRole("Admin") || User.IsInRole("Manager")))
                dto.CashierId = posActorId;

            var createDto = new CreateOrderDto
            {
                TableId = null,
                SessionId = Guid.NewGuid().ToString("N"),
                CustomerName = dto.CustomerName,
                SpecialInstructions = dto.SpecialInstructions,
                Items = dto.Items
            };
            var order = await _orderService.CreateOrderAsync(createDto);

            var orderEntity = await _context.Orders
                .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .FirstAsync(o => o.Id == order.Id);

            orderEntity.Status = SmartMenu.Domain.Enums.OrderStatus.Confirmed;
            orderEntity.UpdatedAt = DateTime.UtcNow;

            decimal baseAmount = dto.Amount > 0 ? dto.Amount : orderEntity.Total;
            decimal tipAmt = dto.TipAmount;

            Payment? payment = null;
            if (dto.SubPayments != null && dto.SubPayments.Count > 0)
            {
                foreach (var sub in dto.SubPayments)
                {
                    _context.Payments.Add(new Payment
                    {
                        OrderId = orderEntity.Id,
                        Method = sub.Method,
                        Amount = sub.Amount,
                        TipAmount = sub.TipAmount,
                        TipPercentage = sub.Amount > 0 ? (sub.TipAmount / sub.Amount) * 100 : 0,
                        TotalAmount = sub.Amount + sub.TipAmount,
                        ProcessedByWaiterId = dto.CashierId,
                        RequiresFiscalReceipt = dto.RequiresFiscalReceipt,
                        RNC = dto.RNC,
                        BusinessName = dto.BusinessName,
                        Status = SmartMenu.Domain.Enums.PaymentStatus.Completed,
                        CompletedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow,
                    });
                }
            }
            else
            {
                payment = new Payment
                {
                    OrderId = orderEntity.Id,
                    Method = dto.PaymentMethod ?? "Cash",
                    Amount = baseAmount,
                    TipAmount = tipAmt,
                    TipPercentage = baseAmount > 0 ? (tipAmt / baseAmount) * 100 : 0,
                    TotalAmount = baseAmount + tipAmt,
                    ProcessedByWaiterId = dto.CashierId,
                    RequiresFiscalReceipt = dto.RequiresFiscalReceipt,
                    RNC = dto.RNC,
                    BusinessName = dto.BusinessName,
                    Status = SmartMenu.Domain.Enums.PaymentStatus.Completed,
                    CompletedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                };
                _context.Payments.Add(payment);
            }

            await _context.SaveChangesAsync();

            try
            {
                var items = orderEntity.Items.Select(i => new { i.Id, dishName = i.Dish?.Name ?? "Plato", i.Quantity, i.Notes }).ToList<object>();
                await _kitchenHub.Clients.Group("kitchen").SendAsync("NewKitchenOrder", new
                {
                    orderId = orderEntity.Id,
                    orderNumber = orderEntity.OrderNumber,
                    isPickup = true,
                    customerName = dto.CustomerName,
                    items,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo notificar a cocina para orden POS {OrderId}", orderEntity.Id);
            }

            try
            {
                await _orderHub.Clients.All.SendAsync("PaymentRegistered", new
                {
                    orderId = orderEntity.Id,
                    orderNumber = orderEntity.OrderNumber,
                    method = dto.PaymentMethod ?? (dto.SubPayments?.Count > 0 ? "Mixed" : "Cash"),
                    amount = baseAmount,
                    tipAmount = tipAmt,
                    totalAmount = baseAmount + tipAmt,
                    completedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo notificar PaymentRegistered para POS {OrderId}", orderEntity.Id);
            }

            _logger.LogInformation("POS order {OrderId} created and paid by cashier {CashierId}", orderEntity.Id, dto.CashierId);
            return Ok(new
            {
                orderId = orderEntity.Id,
                orderNumber = orderEntity.OrderNumber,
                total = orderEntity.Total,
                paid = baseAmount + tipAmt,
                message = "Venta registrada. Orden enviada a cocina."
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating POS order");
            return StatusCode(500, new { error = "Error al procesar la venta" });
        }
    }

    [HttpPut("{orderId}/move-to-table/{newTableId}")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> MoveOrderToTable(int orderId, int newTableId)
    {
        try
        {
            var order = await _orderService.GetOrderByIdAsync(orderId);
            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });

            var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
            if (role != "Admin" && role != "Manager")
            {
                if (role != "Waiter")
                    return Forbid();
                var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(sub, out var userId)) return Unauthorized();
                if (order.AssignedWaiterId != null && order.AssignedWaiterId != userId)
                    return Forbid();
            }

            await _orderService.MoveOrderToTableAsync(orderId, newTableId);

            var (actorUserId, authMethod) = GetActorFromJwt();
            await _audit.LogAsync(
                userId: actorUserId,
                action: "Order.MovedToTable",
                entityType: "Order",
                entityId: orderId,
                ip: HttpContext.Connection.RemoteIpAddress?.ToString(),
                authMethod: authMethod,
                metadata: new {
                    fromTableId = order.TableId,
                    toTableId = newTableId,
                    orderNumber = order.OrderNumber
                });

            var updated = await _orderService.GetOrderByIdAsync(orderId);
            return Ok(new { message = "Orden movida a la nueva mesa", order = updated });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Orden o mesa no encontrada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving order to table");
            return StatusCode(500, new { error = "Error al mover orden" });
        }
    }
}

public class CreatePosOrderDto
{
    public string? CustomerName { get; set; }
    public string? SpecialInstructions { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();

    public int CashierId { get; set; }

    public string? PaymentMethod { get; set; }

    public decimal Amount { get; set; } = 0;
    public decimal TipAmount { get; set; } = 0;

    public List<PosSubPaymentDto>? SubPayments { get; set; }
    public bool RequiresFiscalReceipt { get; set; } = false;
    public string? RNC { get; set; }
    public string? BusinessName { get; set; }
}

public class PosSubPaymentDto
{
    public string Method { get; set; } = "Cash";
    public decimal Amount { get; set; }
    public decimal TipAmount { get; set; } = 0;
}
