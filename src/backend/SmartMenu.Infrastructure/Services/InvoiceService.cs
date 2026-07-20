using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.Application.Settings;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Services;

/// <summary>
/// Checkout multi-franquicia del agregador online: crea UNA Invoice global y la parte en una
/// Order independiente por franquicia (cada KDS ve solo lo suyo), todo dentro de una transacción.
/// Lo fiscal (ITBIS/propina) se calcula POR Order desde <see cref="BillingSettings"/>; la Invoice
/// solo suma para el cobro único del cliente.
/// </summary>
public class InvoiceService : IInvoiceService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<InvoiceService> _logger;
    private readonly BillingSettings _billing;

    public InvoiceService(ApplicationDbContext context, ILogger<InvoiceService> logger, IOptions<BillingSettings> billing)
    {
        _context = context;
        _logger = logger;
        _billing = billing.Value;
    }

    public async Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("El carrito está vacío.");
        // Topes anti-abuso (endpoint anónimo): sin esto un carrito absurdo genera comandas
        // gigantes reales en cocina/impresora.
        if (dto.Items.Count > 50)
            throw new ArgumentException("El carrito no puede tener más de 50 líneas.");
        if (dto.Items.Any(i => i.Quantity > 50))
            throw new ArgumentException("Cantidad máxima por plato: 50.");

        var fulfillment = Enum.TryParse<FulfillmentType>(dto.FulfillmentType, ignoreCase: true, out var ft)
            ? ft : FulfillmentType.Delivery;
        if (fulfillment == FulfillmentType.Delivery && string.IsNullOrWhiteSpace(dto.DeliveryAddress))
            throw new ArgumentException("La dirección de entrega es obligatoria para delivery.");

        // Cargar los platos con la cadena Dish → Category → Menu para DERIVAR la franquicia
        // (Menu.RestaurantId) y el precio SERVER-SIDE. Nunca se confía en el cliente (anti over-posting).
        var dishIds = dto.Items.Select(i => i.DishId).Distinct().ToList();
        var dishes = await _context.Dishes
            .Include(d => d.Category).ThenInclude(c => c!.Menu)
            .Include(d => d.KitchenZone)
            .Where(d => dishIds.Contains(d.Id))
            .ToListAsync();
        var dishMap = dishes.ToDictionary(d => d.Id);
        var missing = dishIds.Except(dishes.Select(d => d.Id)).ToList();
        if (missing.Count > 0)
            throw new ArgumentException($"Platos no encontrados: {string.Join(", ", missing)}");

        // Agrupar los ítems del carrito por franquicia (RestaurantId derivado del menú del plato).
        var groups = dto.Items
            .GroupBy(i => dishMap[i.DishId].Category?.Menu?.RestaurantId)
            .ToList();

        // Toda orden DEBE quedar scopeada a una franquicia (es el propósito de la feature: cada
        // KDS ve solo lo suyo). Un plato cuyo menú no tiene restaurante rompería ese ruteo → rechazar.
        if (groups.Any(g => g.Key == null))
            throw new ArgumentException("Hay platos sin franquicia (menú) asignada; no se puede rutear la orden.");

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Invoice global en estado Pendiente (los totales se llenan al final).
            var invoice = new Invoice
            {
                CustomerName = dto.CustomerName?.Trim() ?? string.Empty,
                CustomerPhone = dto.CustomerPhone?.Trim() ?? string.Empty,
                CustomerEmail = dto.CustomerEmail?.Trim(),
                CustomerId = dto.CustomerId,
                FulfillmentType = fulfillment,
                DeliveryAddress = fulfillment == FulfillmentType.Delivery ? dto.DeliveryAddress?.Trim() : null,
                Notes = dto.Notes?.Trim(),
                PaymentStatus = PaymentStatus.Pending,
                DeliveryStatus = DeliveryStatus.Pending,
            };
            _context.Invoices.Add(invoice);
            await _context.SaveChangesAsync(); // materializa invoice.Id

            decimal invSub = 0, invTax = 0, invTip = 0, invTotal = 0;

            // 2. Una Order independiente por franquicia.
            foreach (var group in groups)
            {
                var restaurantId = group.Key; // garantizado no-null por el guard de arriba

                var items = group.Select(i =>
                {
                    var dish = dishMap[i.DishId];
                    if (i.Quantity <= 0)
                        throw new ArgumentException($"Cantidad inválida para plato {i.DishId}: {i.Quantity}");
                    return new OrderItem
                    {
                        DishId = dish.Id,
                        Quantity = i.Quantity,
                        UnitPrice = dish.Price,                 // precio del catálogo, no del cliente
                        Subtotal = dish.Price * i.Quantity,
                        Notes = i.Notes,
                        Customizations = i.Customizations,
                        Allergies = i.Allergies,
                        CustomerName = dto.CustomerName,
                        IsReady = false,
                        CourseTiming = dish.DefaultCourse,
                        // Ruteo Cocina/Bar reusando el matcher unificado (zona del plato manda).
                        Destination = OrderService.IsDrinkItem(dish.KitchenZone?.Type, dish.Name) ? "Bar" : "Kitchen",
                    };
                }).ToList();

                var subtotal = items.Sum(i => i.Subtotal);
                var tax = decimal.Round(subtotal * _billing.TaxRate, 2, MidpointRounding.AwayFromZero);
                var tip = decimal.Round(subtotal * _billing.TipRate, 2, MidpointRounding.AwayFromZero);
                var total = subtotal + tax + tip;

                var order = new Order
                {
                    OrderNumber = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6]}",
                    InvoiceId = invoice.Id,
                    RestaurantId = restaurantId,
                    TableId = null,
                    IsPickup = true,          // online: sin mesa física
                    SessionId = string.Empty,
                    CustomerName = dto.CustomerName,
                    CustomerId = dto.CustomerId,
                    Subtotal = subtotal,
                    Tax = tax,
                    Tip = tip,
                    Total = total,
                    Status = OrderStatus.Pending,
                    SpecialInstructions = dto.Notes,
                    EstimatedTimeMinutes = items.Count * 10,
                    // Fiscal por franquicia (RNC propio): se propaga la solicitud del cliente a cada Order.
                    ClientRequiresFiscalReceipt = dto.RequiresFiscalReceipt,
                    ClientRNC = dto.RequiresFiscalReceipt ? dto.RNC : null,
                    ClientBusinessName = dto.RequiresFiscalReceipt ? dto.BusinessName : null,
                    Items = items,
                };
                _context.Orders.Add(order);

                invSub += subtotal; invTax += tax; invTip += tip; invTotal += total;
            }

            // 3. Totales de la Invoice = suma de las órdenes (envoltorio de cobro).
            invoice.SubTotal = invSub;
            invoice.TaxITBIS = invTax;
            invoice.LegalTip = invTip;
            invoice.Total = invTotal;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            _logger.LogInformation("Invoice {InvoiceId} creada: {Orders} órden(es) de franquicia, total {Total}.",
                invoice.Id, groups.Count, invTotal);

            return await GetInvoiceByIdAsync(invoice.Id)
                   ?? throw new InvalidOperationException("Invoice creada pero no se pudo recuperar.");
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Error creando invoice multi-franquicia — rollback aplicado.");
            throw;
        }
    }

    public async Task<InvoiceDto?> GetInvoiceByIdAsync(int id)
    {
        var invoice = await _context.Invoices
            .AsNoTracking()
            .Include(inv => inv.Orders).ThenInclude(o => o.Restaurant)
            .Include(inv => inv.Orders).ThenInclude(o => o.Items).ThenInclude(it => it.Dish)
            .FirstOrDefaultAsync(inv => inv.Id == id);
        return invoice == null ? null : MapToDto(invoice);
    }

    public async Task<IEnumerable<InvoiceDto>> GetTrackingAsync(string? deliveryStatus = null)
    {
        var query = _context.Invoices
            .AsNoTracking()
            .Include(inv => inv.Orders).ThenInclude(o => o.Restaurant)
            .Include(inv => inv.Orders).ThenInclude(o => o.Items).ThenInclude(it => it.Dish)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(deliveryStatus)
            && Enum.TryParse<DeliveryStatus>(deliveryStatus, ignoreCase: true, out var ds))
        {
            query = query.Where(inv => inv.DeliveryStatus == ds);
        }

        var invoices = await query
            .OrderByDescending(inv => inv.CreatedAt)
            .Take(200)
            .ToListAsync();
        return invoices.Select(MapToDto).ToList();
    }

    public async Task<InvoiceDto> UpdateDeliveryStatusAsync(int id, string newStatus, IReadOnlyCollection<string>? allowedCurrent = null)
    {
        if (!Enum.TryParse<DeliveryStatus>(newStatus, ignoreCase: true, out var ds))
            throw new ArgumentException($"Estado de entrega inválido: {newStatus}");

        var invoice = await _context.Invoices.FirstOrDefaultAsync(inv => inv.Id == id)
                      ?? throw new ArgumentException($"Invoice {id} no encontrada.");

        // Guard de transicion AUTORITATIVO sobre la entidad trackeada (cierra el TOCTOU:
        // un pre-check en el controller podia quedar stale si el admin cancelaba entre el
        // check y el update — el repartidor habria "entregado" una factura Cancelled).
        if (allowedCurrent != null
            && !allowedCurrent.Contains(invoice.DeliveryStatus.ToString(), StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException(
                $"Transición no permitida: {invoice.DeliveryStatus} → {ds}.");

        invoice.DeliveryStatus = ds;
        invoice.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetInvoiceByIdAsync(id)
               ?? throw new InvalidOperationException("Invoice actualizada pero no recuperable.");
    }

    private static InvoiceDto MapToDto(Invoice inv) => new()
    {
        Id = inv.Id,
        CustomerName = inv.CustomerName,
        CustomerPhone = inv.CustomerPhone,
        CustomerEmail = inv.CustomerEmail,
        FulfillmentType = inv.FulfillmentType.ToString(),
        DeliveryAddress = inv.DeliveryAddress,
        Notes = inv.Notes,
        SubTotal = inv.SubTotal,
        TaxITBIS = inv.TaxITBIS,
        LegalTip = inv.LegalTip,
        Total = inv.Total,
        PaymentStatus = inv.PaymentStatus.ToString(),
        DeliveryStatus = inv.DeliveryStatus.ToString(),
        CreatedAt = inv.CreatedAt,
        Orders = inv.Orders.Select(o => new InvoiceOrderDto
        {
            OrderId = o.Id,
            OrderNumber = o.OrderNumber,
            RestaurantId = o.RestaurantId,
            RestaurantName = o.Restaurant?.Name,
            Status = o.Status.ToString(),
            KitchenReady = o.KitchenReady,
            BarReady = o.BarReady,
            Subtotal = o.Subtotal,
            Tax = o.Tax,
            Tip = o.Tip,
            Total = o.Total,
            Items = o.Items.Select(it => new InvoiceOrderItemDto
            {
                DishId = it.DishId,
                DishName = it.Dish?.Name ?? "Unknown",
                Quantity = it.Quantity,
                UnitPrice = it.UnitPrice,
                Subtotal = it.Subtotal,
            }).ToList(),
        }).ToList(),
    };
}
