using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Repositories;
using SmartMenu.Application.Services;
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

    public OrderService(IOrderRepository orderRepository, ApplicationDbContext context, ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _context = context;
        _logger = logger;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto)
    {
        // Validar que la mesa existe
        var tableExists = await _context.Tables.AnyAsync(t => t.Id == dto.TableId);
        if (!tableExists)
            throw new ArgumentException($"La mesa con Id {dto.TableId} no existe.");

        // Validar que todos los platos existen
        var dishIds = dto.Items.Select(i => i.DishId).Distinct().ToList();
        var existingDishIds = await _context.Dishes.Where(d => dishIds.Contains(d.Id)).Select(d => d.Id).ToListAsync();
        var missing = dishIds.Except(existingDishIds).ToList();
        if (missing.Count > 0)
            throw new ArgumentException($"Platos no encontrados: {string.Join(", ", missing)}");

        // Generar número de orden único
        var orderNumber = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6]}";

        // Calcular totales
        var subtotal = dto.Items.Sum(i => i.UnitPrice * i.Quantity);
        var tax = subtotal * 0.18m; // 18% ITBIS
        var total = subtotal + tax;

        var order = new Order
        {
            OrderNumber = orderNumber,
            TableId = dto.TableId,
            SessionId = dto.SessionId ?? string.Empty,
            CustomerName = dto.CustomerName,
            Subtotal = subtotal,
            Tax = tax,
            Total = total,
            Status = OrderStatus.Pending,
            SpecialInstructions = dto.SpecialInstructions,
            EstimatedTimeMinutes = dto.Items.Count * 10,
            Items = dto.Items.Select(i => new OrderItem
            {
                DishId = i.DishId,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                Subtotal = i.UnitPrice * i.Quantity,
                Notes = i.Notes,
                Customizations = i.Customizations,
                Allergies = i.Allergies,
                SideDish = i.SideDish,
                PreferenceText = i.MeatCooking,
                IsReady = false
            }).ToList()
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

    public async Task<IEnumerable<OrderDto>> GetAllOrdersAsync()
    {
        var orders = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
        return orders.Select(o => MapToOrderDto(o, false, 0));
    }

    public async Task<OrderDto> UpdateOrderStatusAsync(int id, string newStatus)
    {
        var order = await _orderRepository.GetByIdAsync(id);
        if (order == null)
        {
            throw new KeyNotFoundException($"Order {id} not found");
        }

        if (Enum.TryParse<OrderStatus>(newStatus, true, out var status))
        {
            order.Status = status;
            
            if (status == OrderStatus.Completed)
            {
                order.CompletedAt = DateTime.UtcNow;
            }

            await _orderRepository.UpdateAsync(order);
        }
        
        var updatedOrder = await _orderRepository.GetByIdWithItemsAsync(id);
        return MapToOrderDto(updatedOrder!, false, 0);
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
        var order = await _orderRepository.GetByIdAsync(orderId);
        if (order == null)
            throw new KeyNotFoundException($"Orden {orderId} no encontrada.");

        var waiterExists = await _context.Users.AnyAsync(u => u.Id == waiterId);
        if (!waiterExists)
            throw new ArgumentException($"El mesero con Id {waiterId} no existe. Cierra sesión e inicia sesión de nuevo para actualizar tu usuario.");

        order.AssignedWaiterId = waiterId;
        order.Status = Domain.Enums.OrderStatus.Confirmed;
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
                && (o.Status == Domain.Enums.OrderStatus.Pending || o.Status == Domain.Enums.OrderStatus.Confirmed))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        _logger.LogInformation($"🔍 GetUnassignedOrdersAsync - Órdenes no asignadas: {allUnassignedOrders.Count}");

        return allUnassignedOrders.Select(o => MapToOrderDto(o, false));
    }

    public async Task<IEnumerable<OrderDto>> GetOrdersByWaiterAsync(int waiterId)
    {
        var orders = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .Where(o => o.AssignedWaiterId == waiterId
                && (o.Status != Domain.Enums.OrderStatus.Completed
                    || o.Table.Status == Domain.Enums.TableStatus.Cleaning))
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
                .ToListAsync()
            : new List<int>();

        Dictionary<int, decimal> tipLookup;
        if (completedOrderIds.Count > 0)
        {
            var paymentTips = await _context.Payments
                .Where(p => completedOrderIds.Contains(p.OrderId))
                .Select(p => new { p.OrderId, p.TipAmount })
                .ToListAsync();
            tipLookup = paymentTips.ToDictionary(x => x.OrderId, x => x.TipAmount);
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

    private OrderDto MapToOrderDto(Order order, bool paymentCollectedByWaiter = false, decimal paymentTipAmount = 0)
    {
        return new OrderDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            TableId = order.TableId,
            TableNumber = order.Table?.TableNumber.ToString() ?? "N/A",
            CustomerName = order.CustomerName,
            Subtotal = order.Subtotal,
            Tax = order.Tax,
            Total = order.Total,
            Status = order.Status.ToString(),
            KitchenPreparing = order.KitchenPreparing,
            KitchenReady = order.KitchenReady,
            KitchenServed = order.KitchenServed,
            BarPreparing = order.BarPreparing,
            BarReady = order.BarReady,
            BarServed = order.BarServed,
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
                KitchenZoneName = i.Dish?.KitchenZone?.Name
            }).ToList(),
            PaymentCollectedByWaiter = paymentCollectedByWaiter,
            PaymentTipAmount = paymentTipAmount
        };
    }
}
