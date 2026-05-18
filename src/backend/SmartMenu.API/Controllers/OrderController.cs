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

    public OrderController(IOrderService orderService, ILogger<OrderController> logger, IHubContext<KitchenHub> kitchenHub, IHubContext<OrderHub> orderHub, ApplicationDbContext context)
    {
        _orderService = orderService;
        _logger = logger;
        _kitchenHub = kitchenHub;
        _orderHub = orderHub;
        _context = context;
    }

    private static string GetInnermostMessage(Exception ex)
    {
        while (ex.InnerException != null)
            ex = ex.InnerException;
        return ex.Message;
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

    /// <summary>
    /// Crear nueva orden
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<OrderDto>> CreateOrder([FromBody] CreateOrderDto request)
    {
        try
        {
            var order = await _orderService.CreateOrderAsync(request);
            // No notificar a cocina al crear: la orden va al KDS solo cuando el mesero la confirme (UpdateStatus → Confirmed).
            return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Error creating order (DB)");
            var msg = GetInnermostMessage(ex);
            return BadRequest(new { error = msg });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating order");
            var msg = GetInnermostMessage(ex);
            return BadRequest(new { error = msg });
        }
    }

    /// <summary>
    /// Obtener orden por ID
    /// </summary>
    [HttpGet("{id}")]
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

    // IDOR guard: waiters can only access their own assigned orders (or unassigned).
    // Admin/Manager/Cashier/Chef/Bartender/Host see all orders by role function.
    private bool CanAccessOrder(OrderDto order)
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        if (role != "Waiter") return true; // other staff have legit reasons to see any order

        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(sub, out var userId)) return false;

        return order.AssignedWaiterId == null || order.AssignedWaiterId == userId;
    }

    /// <summary>
    /// Obtener todas las órdenes (admin)
    /// </summary>
    [HttpGet("all")]
    [ProducesResponseType(typeof(List<OrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OrderDto>>> GetAllOrders()
    {
        var orders = await _orderService.GetAllOrdersAsync();
        return Ok(orders);
    }

    /// <summary>
    /// Obtener órdenes activas
    /// </summary>
    [HttpGet("active")]
    [ProducesResponseType(typeof(List<OrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OrderDto>>> GetActiveOrders()
    {
        var orders = await _orderService.GetActiveOrdersAsync();
        return Ok(orders);
    }

    /// <summary>
    /// Actualizar estado de orden
    /// </summary>
    [HttpPut("{id}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusDto request)
    {
        try
        {
            var current = await _orderService.GetOrderByIdAsync(id);
            if (current == null)
                return NotFound(new { error = "Orden no encontrada" });
            if (!CanAccessOrder(current))
                return Forbid();

            var order = await _orderService.UpdateOrderStatusAsync(id, request.NewStatus);
            if (string.Equals(request.NewStatus, "Confirmed", StringComparison.OrdinalIgnoreCase))
                await NotifyKitchenAsync(order);
            return Ok(new { message = "Estado actualizado correctamente", order });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating order status");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Cocina marca "Preparando". El cliente verá Preparando solo cuando cocina y bar estén en preparando (si aplica).
    /// </summary>
    [HttpPut("{id}/kitchen-preparing")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
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

    /// <summary>
    /// Cocina marca "Listo". El cliente verá Listo solo cuando cocina y bar estén listos (si aplica).
    /// </summary>
    [HttpPut("{id}/kitchen-ready")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
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

    /// <summary>
    /// Bar marca "Preparando". El cliente verá Preparando solo cuando cocina y bar estén en preparando (si aplica).
    /// </summary>
    [HttpPut("{id}/bar-preparing")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
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

    /// <summary>
    /// Bar marca "Listo". El cliente verá Listo solo cuando cocina y bar estén listos (si aplica).
    /// </summary>
    [HttpPut("{id}/bar-ready")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
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

    /// <summary>
    /// Mesero sirvió los platos de cocina (independiente del bar)
    /// </summary>
    [HttpPut("{id}/kitchen-served")]
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

    /// <summary>
    /// Mesero sirvió las bebidas del bar (independiente de la cocina)
    /// </summary>
    [HttpPut("{id}/bar-served")]
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

    /// <summary>
    /// Cliente marca que terminó de comer
    /// </summary>
    [HttpPut("{id}/customer-finished")]
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

    /// <summary>
    /// Asignar mesero a orden
    /// </summary>
    [HttpPut("{id}/assign-waiter/{waiterId}")]
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

    /// <summary>
    /// Mesero abandona una mesa (desasigna la orden)
    /// </summary>
    [HttpPut("{id}/unassign-waiter")]
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

    /// <summary>
    /// Obtener órdenes no asignadas (para vista "Mesas General")
    /// </summary>
    [HttpGet("unassigned")]
    public async Task<IActionResult> GetUnassignedOrders()
    {
        try
        {
            var orders = await _orderService.GetUnassignedOrdersAsync();
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unassigned orders");
            return StatusCode(500, new { error = "Error al obtener órdenes" });
        }
    }

    /// <summary>
    /// Obtener órdenes por mesero (para vista "Mis Mesas")
    /// </summary>
    [HttpGet("my-orders/{waiterId}")]
    public async Task<IActionResult> GetWaiterOrders(int waiterId)
    {
        try
        {
            var orders = await _orderService.GetOrdersByWaiterAsync(waiterId);
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting waiter orders");
            return StatusCode(500, new { error = "Error al obtener órdenes" });
        }
    }

    /// <summary>
    /// Cliente agrega más ítems a una orden existente (ej. postres).
    /// </summary>
    [HttpPost("{id}/add-items")]
    public async Task<IActionResult> AddItemsToOrder(int id, [FromBody] List<CreateOrderItemDto> items)
    {
        try
        {
            var order = await _orderService.AddItemsToOrderAsync(id, items);

            // Notificar al mesero
            await NotifyWaiterAsync(order, "ItemsAddedToOrder", new
            {
                orderId     = order.Id,
                orderNumber = order.OrderNumber,
                tableNumber = order.TableNumber,
                itemCount   = items.Count,
                message     = $"➕ Mesa {order.TableNumber} agregó {items.Count} ítem(s) a la orden #{order.OrderNumber}",
                timestamp   = DateTime.UtcNow
            });

            // Notificar a cocina/KDS con SOLO los nuevos ítems para que no
            // reprocese los que ya fueron preparados anteriormente.
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

    /// <summary>
    /// POS del cajero: crear orden de mostrador (para llevar) y cobrar en un solo paso.
    /// No requiere mesa. El cajero cobra, la orden va a cocina, el cliente espera en mostrador.
    /// </summary>
    [HttpPost("pos")]
    public async Task<IActionResult> CreatePosOrder([FromBody] CreatePosOrderDto dto)
    {
        try
        {
            // 1. Crear la orden (sin mesa, IsPickup = true)
            var createDto = new CreateOrderDto
            {
                TableId = null,
                SessionId = Guid.NewGuid().ToString("N"),
                CustomerName = dto.CustomerName,
                SpecialInstructions = dto.SpecialInstructions,
                Items = dto.Items
            };
            var order = await _orderService.CreateOrderAsync(createDto);

            // 2. Obtener la entidad de la BD para manipularla
            var orderEntity = await _context.Orders
                .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .FirstAsync(o => o.Id == order.Id);

            // 3. Confirmar la orden → va a cocina/bar
            orderEntity.Status = SmartMenu.Domain.Enums.OrderStatus.Confirmed;
            orderEntity.UpdatedAt = DateTime.UtcNow;

            // 4. Registrar el pago inmediatamente (el cliente paga en mostrador)
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

            // 5. Notificar a cocina
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

    /// <summary>
    /// Mover comensal: cambiar la orden de mesa (de una mesa a otra disponible).
    /// </summary>
    [HttpPut("{orderId}/move-to-table/{newTableId}")]
    public async Task<IActionResult> MoveOrderToTable(int orderId, int newTableId)
    {
        try
        {
            var order = await _orderService.GetOrderByIdAsync(orderId);
            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });
            await _orderService.MoveOrderToTableAsync(orderId, newTableId);
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

/// <summary>DTO para crear una venta en el POS del cajero (mostrador/para llevar).</summary>
public class CreatePosOrderDto
{
    public string? CustomerName { get; set; }
    public string? SpecialInstructions { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
    /// <summary>ID del cajero que procesa la venta.</summary>
    public int CashierId { get; set; }
    /// <summary>Método de pago: Cash | Card | Transfer | Mixed.</summary>
    public string? PaymentMethod { get; set; }
    /// <summary>Monto base a cobrar (si 0, se usa el total calculado de la orden).</summary>
    public decimal Amount { get; set; } = 0;
    public decimal TipAmount { get; set; } = 0;
    /// <summary>Para pago mixto: lista de subpagos.</summary>
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
