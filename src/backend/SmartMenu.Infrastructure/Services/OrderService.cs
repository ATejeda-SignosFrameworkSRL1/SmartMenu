using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Repositories;
using SmartMenu.Application.Services;
using SmartMenu.Application.Settings;
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
        return DrinkKeywords.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase));
    }

    private static (bool HasFood, bool HasDrinks) GetOrderItemTypes(Order order)
    {
        bool hasFood = false, hasDrinks = false;
        foreach (var item in order.Items)
        {
            var name = item.Dish?.Name;
            if (IsDrinkDish(name)) hasDrinks = true;
            else hasFood = true;
        }
        return (hasFood, hasDrinks);
    }
    private readonly IOrderRepository _orderRepository;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<OrderService> _logger;
    private readonly BillingSettings _billing;

    public OrderService(IOrderRepository orderRepository, ApplicationDbContext context, ILogger<OrderService> logger, IOptions<BillingSettings> billing)
    {
        _orderRepository = orderRepository;
        _context = context;
        _logger = logger;
        _billing = billing.Value;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto)
    {
        // Validar que la mesa existe (solo si se especificó mesa; null = para llevar/POS)
        if (dto.TableId.HasValue)
        {
            var tableExists = await _context.Tables.AnyAsync(t => t.Id == dto.TableId.Value);
            if (!tableExists)
                throw new ArgumentException($"La mesa con Id {dto.TableId} no existe.");
        }

        // Validar que todos los platos existen y cargar DefaultCourse
        var dishIds = dto.Items.Select(i => i.DishId).Distinct().ToList();
        var existingDishes = await _context.Dishes.Where(d => dishIds.Contains(d.Id)).ToListAsync();
        var dishMap = existingDishes.ToDictionary(d => d.Id);
        var missing = dishIds.Except(existingDishes.Select(d => d.Id)).ToList();
        if (missing.Count > 0)
            throw new ArgumentException($"Platos no encontrados: {string.Join(", ", missing)}");

        // Generar número de orden único
        var orderNumber = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6]}";

        // ⚠️ Server-side pricing: UnitPrice viene del catálogo, NUNCA del cliente.
        // Evita over-posting / manipulación de precios. dishMap fue cargado de la DB arriba.
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
                IsReady = false,
                CourseTiming = i.CourseTiming ?? dish.DefaultCourse
            };
        }).ToList();

        // Totales calculados sobre precios del servidor.
        var subtotal = items.Sum(i => i.Subtotal);
        var tax = decimal.Round(subtotal * _billing.TaxRate, 2, MidpointRounding.AwayFromZero);
        var tip = decimal.Round(subtotal * _billing.TipRate, 2, MidpointRounding.AwayFromZero);
        var total = subtotal + tax + tip;

        var order = new Order
        {
            OrderNumber = orderNumber,
            TableId = dto.TableId,
            IsPickup = !dto.TableId.HasValue,
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

        // Si la mesa pertenece a una mesa virtual activa, asignar la orden al mesero que la creó
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
            // Si la sesión de mesa tiene un mesero asignado (se quedó con la mesa), auto-asignar
            var activeSession = await _context.TableSessions
                .FirstOrDefaultAsync(ts => ts.TableId == dto.TableId && ts.IsActive && ts.AssignedWaiterId != null);
            if (activeSession?.AssignedWaiterId != null)
            {
                order.AssignedWaiterId = activeSession.AssignedWaiterId;
                _logger.LogInformation($"🟢 Orden asignada automáticamente al mesero {order.AssignedWaiterId} (sesión activa de la mesa {dto.TableId})");
            }
        }

        var createdOrder = await _orderRepository.AddAsync(order);
        
        // Obtener orden con includes para el DTO
        var orderWithIncludes = await _orderRepository.GetByIdWithItemsAsync(createdOrder.Id);
        
        return MapToOrderDto(orderWithIncludes!);
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
        if (pageSize > 200) pageSize = 200; // cap defensivo

        var baseQuery = _context.Orders.AsNoTracking();
        var total = await baseQuery.CountAsync();
        var orders = await baseQuery
            .Include(o => o.Table)
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

    // S4.5 — State machine flexible. Cancelled siempre permitido; Admin override
    // permite cualquier transición (intervención manual auditable).
    // Pending→Confirmed→Preparing→Ready→Served→Completed es el flujo normal.
    private static readonly Dictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new()
    {
        [OrderStatus.Pending]    = new[] { OrderStatus.Confirmed, OrderStatus.Cancelled },
        [OrderStatus.Confirmed]  = new[] { OrderStatus.Preparing, OrderStatus.Cancelled },
        [OrderStatus.Preparing]  = new[] { OrderStatus.Ready, OrderStatus.Cancelled },
        [OrderStatus.Ready]      = new[] { OrderStatus.Served, OrderStatus.Cancelled },
        [OrderStatus.Served]     = new[] { OrderStatus.Completed, OrderStatus.Cancelled },
        [OrderStatus.Completed]  = Array.Empty<OrderStatus>(), // terminal
        [OrderStatus.Cancelled]  = Array.Empty<OrderStatus>(), // terminal
    };

    private static void ValidateStateTransition(OrderStatus current, OrderStatus target, bool isAdminOverride)
    {
        if (current == target) return; // no-op
        if (isAdminOverride) return; // Admin/Manager bypass
        if (target == OrderStatus.Cancelled) return; // siempre permitido
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

            // P0.2 — Guard fiscal: no se puede marcar Completed sin Payment row que cubra el total,
            // salvo que un Admin/Manager pase un OverrideReason explícito (queda auditado).
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

            if (status == OrderStatus.Completed)
            {
                order.CompletedAt = DateTime.UtcNow;
                // Liberar la mesa al completar el pedido (tras el pago)
                if (order.Table != null)
                {
                    // Solo liberar si no hay otras órdenes activas en la misma mesa
                    var hasOtherActiveOrders = await _context.Orders.AnyAsync(o =>
                        o.TableId == order.TableId &&
                        o.Id != order.Id &&
                        o.Status != OrderStatus.Completed &&
                        o.Status != OrderStatus.Cancelled);

                    if (!hasOtherActiveOrders)
                        order.Table.Status = TableStatus.Available;
                }
            }

            await _orderRepository.UpdateAsync(order);
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

        // Solo se puede cancelar antes de que la cocina la empiece a preparar.
        // Pending y Confirmed son los únicos estados cancelables sin perjudicar la cocina.
        if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Confirmed)
            throw new InvalidOperationException(
                $"No se puede cancelar una orden en estado {order.Status}. Solo Pending y Confirmed son cancelables.");

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        order.SpecialInstructions = string.IsNullOrWhiteSpace(reason)
            ? order.SpecialInstructions
            : $"[CANCELADA: {reason}] {order.SpecialInstructions}".Trim();

        // Liberar la mesa si no hay otras órdenes activas en ella.
        if (order.Table != null)
        {
            var hasOtherActive = await _context.Orders.AnyAsync(o =>
                o.TableId == order.TableId &&
                o.Id != order.Id &&
                o.Status != OrderStatus.Completed &&
                o.Status != OrderStatus.Cancelled);
            if (!hasOtherActive)
                order.Table.Status = TableStatus.Available;
        }

        await _orderRepository.UpdateAsync(order);
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

        // Marcar la mesa como Occupied al confirmar el pedido
        if (order.Table != null && order.Table.Status != TableStatus.Occupied)
        {
            order.Table.Status = TableStatus.Occupied;
        }

        await _orderRepository.UpdateAsync(order);
    }

    public async Task UnassignWaiterAsync(int orderId)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null) throw new KeyNotFoundException($"Orden {orderId} no encontrada.");

        // Solo quitar al mesero de la SESIÓN de la mesa para que futuros pedidos no le lleguen.
        // El pedido activo (order.AssignedWaiterId) se mantiene intacto: sigue en "Mis Mesas"
        // hasta que complete su flujo natural.
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
        // Devolver TODAS las órdenes sin asignar, incluyendo las de mesas que pertenecen a una mesa virtual.
        // Así el Waiter App puede mostrarlas en la vista de la mesa virtual (son "mis órdenes" del mesero que creó la VT).
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
                && (o.Status != Domain.Enums.OrderStatus.Completed
                    || (o.Table != null && o.Table.Status == Domain.Enums.TableStatus.Cleaning)))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        // Por cada mesa solo mostrar una orden Completed (la más reciente), para no listar todo el historial
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
            // Usar GroupBy para manejar múltiples pagos por orden (pago mixto/split)
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
        var updated = await _orderRepository.GetByIdWithItemsAsync(orderId);
        return MapToOrderDto(updated!, false, 0);
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
            oldTable.Status = TableStatus.Available; // Mesa de origen queda libre
        newTable.Status = TableStatus.Occupied;      // Mesa destino queda ocupada

        order.TableId = newTableId;
        order.Table = null!;
        await _orderRepository.UpdateAsync(order);
        await _context.SaveChangesAsync();
    }

    public async Task<OrderDto> AddItemsToOrderAsync(int orderId, List<CreateOrderItemDto> newItems)
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

            var dish = await _context.Dishes.FindAsync(dto.DishId)
                ?? throw new ArgumentException($"Plato {dto.DishId} no encontrado");

            if (IsDrinkDish(dish.Name)) newDrinksAdded = true;
            else newFoodAdded = true;

            order.Items.Add(new OrderItem
            {
                DishId         = dto.DishId,
                Quantity       = dto.Quantity,
                UnitPrice      = dish.Price,            // server-side price, no client trust
                Subtotal       = dish.Price * dto.Quantity,
                Notes          = dto.Notes,
                Customizations = dto.Customizations,
                Allergies      = dto.Allergies,
                SideDish       = dto.SideDish,
                CourseTiming   = dto.CourseTiming ?? (CourseTiming?)dish.DefaultCourse,
            });
        }

        // Recalcular totales incluyendo todos los ítems (precios siempre desde el catálogo)
        var subtotal = order.Items.Sum(i => i.UnitPrice * i.Quantity);
        var tax  = decimal.Round(subtotal * _billing.TaxRate, 2, MidpointRounding.AwayFromZero);
        var tip  = decimal.Round(subtotal * _billing.TipRate, 2, MidpointRounding.AwayFromZero);
        order.Subtotal = subtotal;
        order.Tax      = tax;
        order.Tip      = tip;
        order.Total    = subtotal + tax + tip;

        // Solo resetear los flags de la sección que tiene ítems nuevos.
        // Si solo se agregaron bebidas, la cocina ya sirvió su parte → no tocar KitchenServed.
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

        // Si la orden ya estaba Served/Completed, volver a Confirmed
        // para que el KDS la muestre de nuevo con los nuevos ítems.
        if (order.Status == OrderStatus.Served || order.Status == OrderStatus.Completed)
            order.Status = OrderStatus.Confirmed;

        await _context.SaveChangesAsync();

        // Recargar con relaciones completas para el DTO
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
                PreferenceText = i.PreferenceText,
                IsReady = i.IsReady,
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
