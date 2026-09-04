using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Repositories;
using SmartMenu.Application.Services;
using SmartMenu.Application.Settings;
using SmartMenu.Application.Common;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Services;

public class OrderService : IOrderService
{
    private static readonly string[] DrinkKeywords = ["cerveza", "vino", "cóctel", "refresco", "agua", "cafe", "té", "bebida", "margarita", "ron", "whisky", "colada", "piña colada", "mojito", "daiquiri", "soda", "jugo", "limonada", "batido", "smoothie", "copa", "trago", "coca", "pepsi"];

    private static bool IsDrinkDish(string? dishName)
    {
        if (string.IsNullOrWhiteSpace(dishName)) return false;
        var name = dishName.Trim().ToLowerInvariant();

        var words = System.Text.RegularExpressions.Regex
            .Split(name, "[^a-záéíóúüñ]+")
            .Where(w => w.Length > 0)
            .ToHashSet();
        return DrinkKeywords.Any(k => k.Contains(' ')
            ? name.Contains(k, StringComparison.Ordinal)
            : words.Contains(k) || words.Contains(k + "s") || words.Contains(k + "es"));
    }

    internal static bool IsDrinkItem(string? kitchenZoneType, string? dishName) => kitchenZoneType switch
    {
        "Bar" => true,
        "Kitchen" => false,
        _ => IsDrinkDish(dishName),
    };

    private static (bool HasFood, bool HasDrinks) GetOrderItemTypes(Order order)
    {
        bool hasFood = false, hasDrinks = false;
        foreach (var item in order.Items)
        {
            if (IsDrinkItem(item.Dish?.KitchenZone?.Type, item.Dish?.Name)) hasDrinks = true;
            else hasFood = true;
        }
        return (hasFood, hasDrinks);
    }
    private readonly IOrderRepository _orderRepository;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<OrderService> _logger;
    private readonly BillingSettings _billing;
    private readonly ITableRealtimeNotifier _tableNotifier;
    private readonly ITableStatusBroadcaster _broadcaster;

    public OrderService(IOrderRepository orderRepository, ApplicationDbContext context, ILogger<OrderService> logger, IOptions<BillingSettings> billing, ITableRealtimeNotifier tableNotifier, ITableStatusBroadcaster broadcaster)
    {
        _orderRepository = orderRepository;
        _context = context;
        _logger = logger;
        _billing = billing.Value;
        _tableNotifier = tableNotifier;
        _broadcaster = broadcaster;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto)
    {

        if (dto.TableId.HasValue)
        {
            var tableExists = await _context.Tables.AnyAsync(t => t.Id == dto.TableId.Value);
            if (!tableExists)
                throw new ArgumentException($"La mesa con Id {dto.TableId} no existe.");
        }

        var dishIds = dto.Items.Select(i => i.DishId).Distinct().ToList();
        var existingDishes = await _context.Dishes
            .Include(d => d.KitchenZone)
            .Where(d => dishIds.Contains(d.Id))
            .ToListAsync();
        var dishMap = existingDishes.ToDictionary(d => d.Id);
        var missing = dishIds.Except(existingDishes.Select(d => d.Id)).ToList();
        if (missing.Count > 0)
            throw new ArgumentException($"Platos no encontrados: {string.Join(", ", missing)}");

        var orderNumber = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6]}";

        var items = dto.Items.Select(i =>
        {
            if (!dishMap.TryGetValue(i.DishId, out var dish))
                throw new ArgumentException($"Plato {i.DishId} no encontrado");
            if (i.Quantity <= 0)
                throw new ArgumentException($"Cantidad inválida para plato {i.DishId}: {i.Quantity}");
            return new OrderItem
            {
                DishId = i.DishId,
                Quantity = i.Quantity,
                UnitPrice = dish.Price,
                Subtotal = dish.Price * i.Quantity,
                Notes = i.Notes,
                Customizations = i.Customizations,
                Allergies = i.Allergies,
                SideDish = i.SideDish,
                PreferenceText = i.MeatCooking,
                CustomerName = dto.CustomerName,
                IsReady = false,
                CourseTiming = i.CourseTiming ?? dish.DefaultCourse,

                Destination = IsDrinkItem(dish.KitchenZone?.Type, dish.Name) ? "Bar" : "Kitchen"
            };
        }).ToList();

        var subtotal = items.Sum(i => i.Subtotal);
        var tax = decimal.Round(subtotal * _billing.TaxRate, 2, MidpointRounding.AwayFromZero);
        var tip = decimal.Round(subtotal * _billing.TipRate, 2, MidpointRounding.AwayFromZero);
        var total = subtotal + tax + tip;

        var order = new Order
        {
            OrderNumber = orderNumber,
            TableId = dto.TableId,
            IsPickup = !dto.TableId.HasValue,
            IsTakeaway = dto.IsTakeaway,
            SessionId = dto.SessionId ?? string.Empty,
            CustomerName = dto.CustomerName,
            Subtotal = subtotal,
            Tax = tax,
            Tip = tip,
            Total = total,
            Status = OrderStatus.Pending,
            SpecialInstructions = dto.SpecialInstructions,
            EstimatedTimeMinutes = dto.Items.Count * 10,
            Items = items
        };

        var vtt = await _context.VirtualTableTables
            .Include(v => v.VirtualTable)
            .FirstOrDefaultAsync(v => v.TableId == dto.TableId && v.VirtualTable.IsActive);
        if (vtt?.VirtualTable != null)
        {
            order.AssignedWaiterId = vtt.VirtualTable.CreatedByWaiterId;
            _logger.LogInformation($"🟢 Orden asignada automáticamente al mesero {order.AssignedWaiterId} (mesa virtual \"{vtt.VirtualTable.Name}\")");
        }
        else
        {

            var activeSession = await _context.TableSessions
                .FirstOrDefaultAsync(ts => ts.TableId == dto.TableId && ts.IsActive && ts.AssignedWaiterId != null);
            if (activeSession?.AssignedWaiterId != null)
            {
                order.AssignedWaiterId = activeSession.AssignedWaiterId;
                _logger.LogInformation($"🟢 Orden asignada automáticamente al mesero {order.AssignedWaiterId} (sesión activa de la mesa {dto.TableId})");
            }
        }

        var createdOrder = await _orderRepository.AddAsync(order);

        if (dto.TableId.HasValue)
        {
            var table = await _context.Tables.FirstOrDefaultAsync(t => t.Id == dto.TableId.Value);
            if (table != null && (table.Status == TableStatus.Available || table.Status == TableStatus.Reserved))
            {
                table.Status = TableStatus.Occupied;
                await _context.SaveChangesAsync();
                await _broadcaster.BroadcastAsync(table.Id);
            }
        }

        var orderWithIncludes = await _orderRepository.GetByIdWithItemsAsync(createdOrder.Id);

        return MapToOrderDto(orderWithIncludes!);
    }

    public async Task<int?> GetActiveOrderIdForTableAsync(int tableId)
    {

        return await _context.Orders
            .Where(o => o.TableId == tableId
                     && !o.IsTakeaway
                     && o.Status != OrderStatus.Completed
                     && o.Status != OrderStatus.Cancelled)
            .OrderByDescending(o => o.Id)
            .Select(o => (int?)o.Id)
            .FirstOrDefaultAsync();
    }

    public async Task<OrderDto?> GetOrderByIdAsync(int id)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(id);
        return order == null ? null : MapToOrderDto(order);
    }

    public async Task<IEnumerable<OrderDto>> GetActiveOrdersAsync()
    {
        var orders = await _orderRepository.GetActiveOrdersAsync();
        return orders.Select(o => MapToOrderDto(o, false, 0));
    }

    public async Task<PagedResult<OrderDto>> GetActiveOrdersPagedAsync(int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var baseQuery = _context.Orders
            .AsNoTracking()
            .Where(o => o.Status != OrderStatus.Completed && o.Status != OrderStatus.Cancelled);
        var total = await baseQuery.CountAsync();
        var orders = await baseQuery
            .Include(o => o.Items).ThenInclude(i => i.Dish).ThenInclude(d => d!.KitchenZone)
            .Include(o => o.Items).ThenInclude(i => i.Dish).ThenInclude(d => d!.Category)
            .Include(o => o.Table)
            .Include(o => o.Invoice)
            .AsSplitQuery()
            .OrderBy(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        return new PagedResult<OrderDto>
        {
            Items = orders.Select(o => MapToOrderDto(o, false, 0)).ToList(),
            Page = page, PageSize = pageSize, Total = total
        };
    }

    public async Task<IEnumerable<OrderDto>> GetAllOrdersAsync()
    {
        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Table)
            .Include(o => o.Invoice)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
        return orders.Select(o => MapToOrderDto(o, false, 0));
    }

    public async Task<PagedResult<OrderDto>> GetAllOrdersPagedAsync(int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var baseQuery = _context.Orders.AsNoTracking();
        var total = await baseQuery.CountAsync();
        var orders = await baseQuery
            .Include(o => o.Table)
            .Include(o => o.Invoice)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<OrderDto>
        {
            Items = orders.Select(o => MapToOrderDto(o, false, 0)).ToList(),
            Page = page,
            PageSize = pageSize,
            Total = total
        };
    }

    private static readonly Dictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new()
    {
        [OrderStatus.Pending]    = new[] { OrderStatus.Confirmed, OrderStatus.Cancelled },
        [OrderStatus.Confirmed]  = new[] { OrderStatus.Preparing, OrderStatus.Cancelled },
        [OrderStatus.Preparing]  = new[] { OrderStatus.Ready, OrderStatus.Cancelled },
        [OrderStatus.Ready]      = new[] { OrderStatus.Served, OrderStatus.Cancelled },
        [OrderStatus.Served]     = new[] { OrderStatus.Completed, OrderStatus.Cancelled },
        [OrderStatus.Completed]  = Array.Empty<OrderStatus>(),
        [OrderStatus.Cancelled]  = Array.Empty<OrderStatus>(),
    };

    private static void ValidateStateTransition(OrderStatus current, OrderStatus target, bool isAdminOverride)
    {
        if (current == target) return;
        if (isAdminOverride) return;
        if (target == OrderStatus.Cancelled) return;
        if (!AllowedTransitions.TryGetValue(current, out var allowed) || !allowed.Contains(target))
            throw new InvalidOperationException(
                $"Transición de estado inválida: {current} → {target}. " +
                $"Desde {current} solo se permite: {string.Join(", ", allowed?.Select(s => s.ToString()) ?? Array.Empty<string>())}.");
    }

    public async Task<OrderDto> UpdateOrderStatusAsync(int id, string newStatus, bool isAdminOverride = false, string? overrideReason = null)
    {
        var order = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
        {
            throw new KeyNotFoundException($"Order {id} not found");
        }

        if (Enum.TryParse<OrderStatus>(newStatus, true, out var status))
        {
            ValidateStateTransition(order.Status, status, isAdminOverride);

            if (status == OrderStatus.Completed && order.Status != OrderStatus.Completed)
            {
                var paidSum = await _context.Payments
                    .Where(p => p.OrderId == order.Id && p.Status == Domain.Enums.PaymentStatus.Completed)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;
                var shortage = order.Total - paidSum;
                if (shortage > 0.01m)
                {
                    if (!isAdminOverride)
                        throw new InvalidOperationException(
                            $"No se puede completar la orden sin cobro: total={order.Total:0.00}, cobrado={paidSum:0.00}, falta={shortage:0.00}. Procesa el pago primero via /api/payment/collect.");

                    if (string.IsNullOrWhiteSpace(overrideReason))
                        throw new InvalidOperationException(
                            $"Override de Admin requiere OverrideReason explícito (falta cobrar {shortage:0.00}). Este cierre quedará auditado.");

                    _logger?.LogWarning("ADMIN OVERRIDE: Order {OrderId} completed sin pago completo. Falta: {Shortage:0.00}. Razón: {Reason}", order.Id, shortage, overrideReason);
                }
            }

            order.Status = status;

            int? freedTableId = null;
            if (status == OrderStatus.Completed)
            {
                order.CompletedAt = DateTime.UtcNow;

                if (order.Table != null)
                {

                    var hasOtherActiveOrders = await _context.Orders.AnyAsync(o =>
                        o.TableId == order.TableId &&
                        o.Id != order.Id &&
                        o.Status != OrderStatus.Completed &&
                        o.Status != OrderStatus.Cancelled);

                    if (!hasOtherActiveOrders)
                    {
                        order.Table.Status = TableStatus.Available;
                        freedTableId = order.Table.Id;

                        var activeSession = await _context.TableSessions
                            .FirstOrDefaultAsync(ts => ts.TableId == order.TableId && ts.IsActive);
                        if (activeSession != null)
                        {
                            activeSession.IsActive = false;
                            activeSession.EndTime = DateTime.UtcNow;
                        }
                    }
                }
            }

            await _orderRepository.UpdateAsync(order);
            if (freedTableId != null)
            {
                await _broadcaster.BroadcastAsync(freedTableId.Value);
                await NotifyTableWaiterAsync(freedTableId.Value, null);
            }
        }

        var updatedOrder = await _orderRepository.GetByIdWithItemsAsync(id);
        return MapToOrderDto(updatedOrder!, false, 0);
    }

    public async Task<OrderDto> CancelOrderAsync(int id, string reason)
    {
        var order = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Dish)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) throw new KeyNotFoundException($"Order {id} not found");

        if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Confirmed)
            throw new InvalidOperationException(
                $"No se puede cancelar una orden en estado {order.Status}. Solo Pending y Confirmed son cancelables.");

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        order.SpecialInstructions = string.IsNullOrWhiteSpace(reason)
            ? order.SpecialInstructions
            : $"[CANCELADA: {reason}] {order.SpecialInstructions}".Trim();

        int? freedTableId = null;
        if (order.Table != null)
        {
            var hasOtherActive = await _context.Orders.AnyAsync(o =>
                o.TableId == order.TableId &&
                o.Id != order.Id &&
                o.Status != OrderStatus.Completed &&
                o.Status != OrderStatus.Cancelled);
            if (!hasOtherActive)
            {
                order.Table.Status = TableStatus.Available;
                freedTableId = order.Table.Id;

                var activeSession = await _context.TableSessions
                    .FirstOrDefaultAsync(ts => ts.TableId == order.TableId && ts.IsActive);
                if (activeSession != null)
                {
                    activeSession.IsActive = false;
                    activeSession.EndTime = DateTime.UtcNow;
                }
            }
        }

        await _orderRepository.UpdateAsync(order);
        if (freedTableId != null)
        {
            await _broadcaster.BroadcastAsync(freedTableId.Value);
            await NotifyTableWaiterAsync(freedTableId.Value, null);
        }
        var updated = await _orderRepository.GetByIdWithItemsAsync(id);
        return MapToOrderDto(updated!, false, 0);
    }

    public async Task MarkCustomerFinishedAsync(int orderId)
    {
        var order = await _orderRepository.GetByIdAsync(orderId);
        if (order == null)
            throw new KeyNotFoundException($"Order {orderId} not found");

        order.CustomerFinishedEating = true;
        order.FinishedEatingAt = DateTime.UtcNow;
        await _orderRepository.UpdateAsync(order);
    }

    public async Task AssignWaiterAsync(int orderId, int waiterId)
    {
        var order = await _context.Orders
            .Include(o => o.Table)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null)
            throw new KeyNotFoundException($"Orden {orderId} no encontrada.");

        var waiterExists = await _context.Users.AnyAsync(u => u.Id == waiterId);
        if (!waiterExists)
            throw new ArgumentException($"El mesero con Id {waiterId} no existe. Cierra sesión e inicia sesión de nuevo para actualizar tu usuario.");

        order.AssignedWaiterId = waiterId;
        order.Status = Domain.Enums.OrderStatus.Confirmed;

        int? nowOccupiedTableId = null;
        if (order.Table != null && order.Table.Status != TableStatus.Occupied)
        {
            order.Table.Status = TableStatus.Occupied;
            nowOccupiedTableId = order.Table.Id;
        }

        await _orderRepository.UpdateAsync(order);
        if (nowOccupiedTableId != null)
            await _broadcaster.BroadcastAsync(nowOccupiedTableId.Value);
        if (order.TableId != null)
            await NotifyTableWaiterAsync(order.TableId.Value, waiterId);
    }

    private async Task NotifyTableWaiterAsync(int tableId, int? waiterId)
    {
        if (waiterId == null)
        {
            await _tableNotifier.TableWaiterChangedAsync(tableId, null, null);
            return;
        }
        var w = await _context.Users.AsNoTracking()
            .Where(u => u.Id == waiterId.Value)
            .Select(u => new { u.FirstName, u.LastName })
            .FirstOrDefaultAsync();
        await _tableNotifier.TableWaiterChangedAsync(tableId,
            NameFormatting.Initials(w?.FirstName, w?.LastName),
            NameFormatting.FullName(w?.FirstName, w?.LastName));
    }

    public async Task UnassignWaiterAsync(int orderId)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Orden {orderId} no encontrada.");

        var activeSession = await _context.TableSessions
            .FirstOrDefaultAsync(ts => ts.TableId == order.TableId && ts.IsActive);
        if (activeSession != null)
        {
            activeSession.AssignedWaiterId = null;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<IEnumerable<OrderDto>> GetUnassignedOrdersAsync()
    {

        var allUnassignedOrders = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .Where(o => o.AssignedWaiterId == null
                && o.Status != Domain.Enums.OrderStatus.Completed
                && o.Status != Domain.Enums.OrderStatus.Cancelled)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        _logger.LogInformation($"🔍 GetUnassignedOrdersAsync - Órdenes no asignadas: {allUnassignedOrders.Count}");

        return allUnassignedOrders.Select(o => MapToOrderDto(o, false));
    }

    public async Task<PagedResult<OrderDto>> GetUnassignedOrdersPagedAsync(int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var baseQuery = _context.Orders
            .AsNoTracking()
            .Where(o => o.AssignedWaiterId == null
                && o.Status != OrderStatus.Completed
                && o.Status != OrderStatus.Cancelled);
        var total = await baseQuery.CountAsync();
        var orders = await baseQuery
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Dish)
            .AsSplitQuery()
            .OrderBy(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        return new PagedResult<OrderDto>
        {
            Items = orders.Select(o => MapToOrderDto(o, false)).ToList(),
            Page = page, PageSize = pageSize, Total = total
        };
    }

    public async Task<PagedResult<OrderDto>> GetOrdersByWaiterPagedAsync(int waiterId, int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var baseQuery = _context.Orders
            .AsNoTracking()
            .Where(o => o.AssignedWaiterId == waiterId
                && (o.Status != OrderStatus.Completed
                    || (o.Table != null && o.Table.Status == TableStatus.Cleaning)));
        var total = await baseQuery.CountAsync();
        var orders = await baseQuery
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Dish)
            .AsSplitQuery()
            .OrderBy(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        return new PagedResult<OrderDto>
        {
            Items = orders.Select(o => MapToOrderDto(o, false, 0)).ToList(),
            Page = page, PageSize = pageSize, Total = total
        };
    }

    public async Task<IEnumerable<OrderDto>> GetOrdersByWaiterAsync(int waiterId)
    {
        var orders = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .Where(o => o.AssignedWaiterId == waiterId
                && (

                    (o.Status != Domain.Enums.OrderStatus.Completed && o.Status != Domain.Enums.OrderStatus.Cancelled)

                    || (o.Status == Domain.Enums.OrderStatus.Completed && o.Table != null && o.Table.Status == Domain.Enums.TableStatus.Cleaning)

                    || (o.Status == Domain.Enums.OrderStatus.Cancelled && o.Table != null && o.Table.Status != Domain.Enums.TableStatus.Available)
                ))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        var activeOrders = orders.Where(o => o.Status != Domain.Enums.OrderStatus.Completed);
        var completedDeduped = orders
            .Where(o => o.Status == Domain.Enums.OrderStatus.Completed)
            .GroupBy(o => o.TableId)
            .Select(g => g.OrderByDescending(o => o.Id).First())
            .ToList();
        var combined = activeOrders.Concat(completedDeduped).OrderBy(o => o.CreatedAt).ToList();

        var completedOrderIds = completedDeduped.Select(o => o.Id).ToList();
        var collectedOrderIds = completedOrderIds.Count > 0
            ? await _context.Payments
                .Where(p => completedOrderIds.Contains(p.OrderId) && p.ProcessedByWaiterId == waiterId)
                .Select(p => p.OrderId)
                .Distinct()
                .ToListAsync()
            : new List<int>();

        Dictionary<int, decimal> tipLookup;
        if (completedOrderIds.Count > 0)
        {
            var paymentTips = await _context.Payments
                .Where(p => completedOrderIds.Contains(p.OrderId))
                .Select(p => new { p.OrderId, p.TipAmount })
                .ToListAsync();

            tipLookup = paymentTips
                .GroupBy(x => x.OrderId)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.TipAmount));
        }
        else
        {
            tipLookup = new Dictionary<int, decimal>();
        }

        return combined.Select((Order o) => MapToOrderDto(o, collectedOrderIds.Contains(o.Id), tipLookup.GetValueOrDefault(o.Id, 0)));
    }

    public async Task<OrderDto> SetKitchenPreparingAsync(int orderId)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Order {orderId} not found");
        order.KitchenPreparing = true;
        var (hasFood, hasDrinks) = GetOrderItemTypes(order);
        if (hasFood && (!hasDrinks || order.BarPreparing))
            order.Status = OrderStatus.Preparing;
        await _orderRepository.UpdateAsync(order);
        var updated = await _orderRepository.GetByIdWithItemsAsync(orderId);
        return MapToOrderDto(updated!, false, 0);
    }

    public async Task<OrderDto> SetKitchenReadyAsync(int orderId)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Order {orderId} not found");
        order.KitchenReady = true;
        var (hasFood, hasDrinks) = GetOrderItemTypes(order);
        if (hasFood && (!hasDrinks || order.BarReady))
            order.Status = OrderStatus.Ready;
        await _orderRepository.UpdateAsync(order);
        await AdvanceInvoiceIfReadyAsync(order);
        var updated = await _orderRepository.GetByIdWithItemsAsync(orderId);
        return MapToOrderDto(updated!, false, 0);
    }

    private async Task AdvanceInvoiceIfReadyAsync(Order order)
    {
        if (order.InvoiceId == null) return;
        try
        {
            var invoice = await _context.Invoices.FirstOrDefaultAsync(i => i.Id == order.InvoiceId.Value);
            if (invoice == null) return;
            if (invoice.DeliveryStatus is not (DeliveryStatus.Pending or DeliveryStatus.Confirmed or DeliveryStatus.Preparing))
                return;

            var siblings = await _context.Orders
                .Include(o => o.Items).ThenInclude(it => it.Dish).ThenInclude(d => d!.KitchenZone)
                .Where(o => o.InvoiceId == invoice.Id && o.Status != OrderStatus.Cancelled)
                .ToListAsync();
            if (siblings.Count == 0) return;

            var allReady = siblings.All(o =>
            {
                var (f, d) = GetOrderItemTypes(o);
                return (!f || o.KitchenReady) && (!d || o.BarReady);
            });
            if (allReady)
            {
                invoice.DeliveryStatus = DeliveryStatus.ReadyForPickup;
                invoice.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                _logger.LogInformation("Invoice {InvoiceId} auto-avanzada a ReadyForPickup (cocina/bar listos).", invoice.Id);
            }
        }
        catch (Exception ex)
        {

            _logger.LogWarning(ex, "No se pudo auto-avanzar la invoice de la orden {OrderId}", order.Id);
        }
    }

    public async Task<OrderDto> SetBarPreparingAsync(int orderId)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Order {orderId} not found");
        order.BarPreparing = true;
        var (hasFood, hasDrinks) = GetOrderItemTypes(order);
        if (hasDrinks && (!hasFood || order.KitchenPreparing))
            order.Status = OrderStatus.Preparing;
        await _orderRepository.UpdateAsync(order);
        var updated = await _orderRepository.GetByIdWithItemsAsync(orderId);
        return MapToOrderDto(updated!, false, 0);
    }

    public async Task<OrderDto> SetBarReadyAsync(int orderId)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Order {orderId} not found");
        order.BarReady = true;
        var (hasFood, hasDrinks) = GetOrderItemTypes(order);
        if (hasDrinks && (!hasFood || order.KitchenReady))
            order.Status = OrderStatus.Ready;
        await _orderRepository.UpdateAsync(order);
        await AdvanceInvoiceIfReadyAsync(order);
        var updated = await _orderRepository.GetByIdWithItemsAsync(orderId);
        return MapToOrderDto(updated!, false, 0);
    }

    public async Task<OrderDto> SetKitchenServedAsync(int orderId)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Order {orderId} not found");
        order.KitchenServed = true;
        var (hasFood, hasDrinks) = GetOrderItemTypes(order);
        if (!hasDrinks || order.BarServed)
        {
            order.Status = OrderStatus.Served;
            order.ServedAt = DateTime.UtcNow;
        }
        await _orderRepository.UpdateAsync(order);
        var updated = await _orderRepository.GetByIdWithItemsAsync(orderId);
        return MapToOrderDto(updated!, false, 0);
    }

    public async Task<OrderDto> SetBarServedAsync(int orderId)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Order {orderId} not found");
        order.BarServed = true;
        var (hasFood, hasDrinks) = GetOrderItemTypes(order);
        if (!hasFood || order.KitchenServed)
        {
            order.Status = OrderStatus.Served;
            order.ServedAt = DateTime.UtcNow;
        }
        await _orderRepository.UpdateAsync(order);
        var updated = await _orderRepository.GetByIdWithItemsAsync(orderId);
        return MapToOrderDto(updated!, false, 0);
    }

    public async Task MoveOrderToTableAsync(int orderId, int newTableId)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Order {orderId} not found");
        var oldTableId = order.TableId;
        if (oldTableId == newTableId) throw new ArgumentException("La orden ya está en esa mesa");

        var newTable = await _context.Tables.FindAsync(newTableId);
        if (newTable == null) throw new ArgumentException("La mesa destino no existe");

        var oldTable = await _context.Tables.FindAsync(oldTableId);
        if (oldTable != null)
            oldTable.Status = TableStatus.Available;
        newTable.Status = TableStatus.Occupied;

        order.TableId = newTableId;
        order.Table = null!;
        await _orderRepository.UpdateAsync(order);
        await _context.SaveChangesAsync();

        if (oldTableId != null)
        {
            await _broadcaster.BroadcastAsync(oldTableId.Value);
            await NotifyTableWaiterAsync(oldTableId.Value, null);
        }
        await _broadcaster.BroadcastAsync(newTableId);
        await NotifyTableWaiterAsync(newTableId, order.AssignedWaiterId);
    }

    public async Task<OrderDto> AddItemsToOrderAsync(int orderId, List<CreateOrderItemDto> newItems, string? customerName = null)
    {
        var order = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Dish).ThenInclude(d => d!.Category)
            .Include(o => o.Items).ThenInclude(i => i.Dish).ThenInclude(d => d!.KitchenZone)
            .FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Orden {orderId} no encontrada.");

        bool newFoodAdded = false, newDrinksAdded = false;
        foreach (var dto in newItems)
        {
            if (dto.Quantity <= 0)
                throw new ArgumentException($"Cantidad inválida para plato {dto.DishId}: {dto.Quantity}");

            var dish = await _context.Dishes
                .Include(d => d.KitchenZone)
                .FirstOrDefaultAsync(d => d.Id == dto.DishId)
                ?? throw new ArgumentException($"Plato {dto.DishId} no encontrado");

            var isDrink = IsDrinkItem(dish.KitchenZone?.Type, dish.Name);
            if (isDrink) newDrinksAdded = true;
            else newFoodAdded = true;

            order.Items.Add(new OrderItem
            {
                DishId         = dto.DishId,
                Quantity       = dto.Quantity,
                UnitPrice      = dish.Price,
                Subtotal       = dish.Price * dto.Quantity,
                Notes          = dto.Notes,
                Customizations = dto.Customizations,
                Allergies      = dto.Allergies,
                SideDish       = dto.SideDish,
                CustomerName   = customerName,
                CourseTiming   = dto.CourseTiming ?? (CourseTiming?)dish.DefaultCourse,

                Destination    = isDrink ? "Bar" : "Kitchen",
            });
        }

        var subtotal = order.Items.Sum(i => i.UnitPrice * i.Quantity);
        var tax  = decimal.Round(subtotal * _billing.TaxRate, 2, MidpointRounding.AwayFromZero);
        var tip  = decimal.Round(subtotal * _billing.TipRate, 2, MidpointRounding.AwayFromZero);
        order.Subtotal = subtotal;
        order.Tax      = tax;
        order.Tip      = tip;
        order.Total    = subtotal + tax + tip;

        if (newFoodAdded)
        {
            order.KitchenPreparing = false;
            order.KitchenReady     = false;
            order.KitchenServed    = false;
        }
        if (newDrinksAdded)
        {
            order.BarPreparing = false;
            order.BarReady     = false;
            order.BarServed    = false;
        }

        if (order.Status == OrderStatus.Served || order.Status == OrderStatus.Completed)
            order.Status = OrderStatus.Confirmed;

        await _context.SaveChangesAsync();

        var updated = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Dish).ThenInclude(d => d!.Category)
            .Include(o => o.Items).ThenInclude(i => i.Dish).ThenInclude(d => d!.KitchenZone)
            .FirstAsync(o => o.Id == orderId);

        return MapToOrderDto(updated);
    }

    private OrderDto MapToOrderDto(Order order, bool paymentCollectedByWaiter = false, decimal paymentTipAmount = 0)
    {
        return new OrderDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            TableId = order.TableId,
            IsPickup = order.IsPickup,
            IsTakeaway = order.IsTakeaway,

            FulfillmentType = order.Invoice != null
                ? order.Invoice.FulfillmentType.ToString()
                : (order.IsPickup ? "Pickup" : "DineIn"),
            TableNumber = order.IsPickup ? "Mostrador" : (order.Table?.TableNumber.ToString() ?? "N/A"),
            CustomerName = order.CustomerName,
            AssignedWaiterId = order.AssignedWaiterId,
            Subtotal = order.Subtotal,
            Tax = order.Tax,
            Tip = order.Tip,
            Total = order.Total,
            Status = order.Status.ToString(),
            KitchenPreparing = order.KitchenPreparing,
            KitchenReady = order.KitchenReady,
            KitchenServed = order.KitchenServed,
            BarPreparing = order.BarPreparing,
            BarReady = order.BarReady,
            BarServed = order.BarServed,
            CustomerFinishedEating = order.CustomerFinishedEating,
            SpecialInstructions = order.SpecialInstructions,
            CreatedAt = order.CreatedAt,
            Items = order.Items.Select(i => new OrderItemDto
            {
                Id = i.Id,
                DishId = i.DishId,
                DishName = i.Dish?.Name ?? "Unknown",
                CategoryName = i.Dish?.Category?.Name,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                Subtotal = i.Subtotal,
                Notes = i.Notes,
                Customizations = i.Customizations,
                Allergies = i.Allergies,
                SideDish = i.SideDish,
                CustomerName = i.CustomerName,
                PreferenceText = i.PreferenceText,
                IsReady = i.IsReady,

                IsDrink = i.Destination == "Bar"
                    || (i.Destination == null && IsDrinkItem(i.Dish?.KitchenZone?.Type, i.Dish?.Name)),
                KitchenZoneId = i.Dish?.KitchenZoneId,
                KitchenZoneName = i.Dish?.KitchenZone?.Name,
                CourseTiming = i.CourseTiming?.ToString()
            }).ToList(),
            PaymentCollectedByWaiter = paymentCollectedByWaiter,
            PaymentTipAmount = paymentTipAmount,
            ClientRequestedPaymentMethod = order.ClientRequestedPaymentMethod,
            ClientTipPercentage = order.ClientTipPercentage,
            ClientTipAmount = order.ClientTipAmount,
            ClientRequiresFiscalReceipt = order.ClientRequiresFiscalReceipt,
            ClientRNC = order.ClientRNC,
            ClientBusinessName = order.ClientBusinessName
        };
    }
}
