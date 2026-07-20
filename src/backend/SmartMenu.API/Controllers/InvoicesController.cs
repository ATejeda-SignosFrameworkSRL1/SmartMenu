using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.API.Hubs;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

/// <summary>
/// Facturas globales del agregador multi-franquicia (delivery/pickup online): checkout del
/// cliente (un pago, N órdenes por franquicia) + seguimiento (tracking) para el admin.
/// El tracking está detrás de un switch por restaurante (DeliveryTrackingEnabled), igual que
/// el switch del plano de planta.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoices;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<InvoicesController> _logger;
    private readonly IHubContext<KitchenHub> _kitchenHub;

    public InvoicesController(IInvoiceService invoices, ApplicationDbContext context, ILogger<InvoicesController> logger, IHubContext<KitchenHub> kitchenHub)
    {
        _invoices = invoices;
        _context = context;
        _logger = logger;
        _kitchenHub = kitchenHub;
    }

    // POST /api/invoices — checkout del cliente (carrito mixto → una Invoice + N Orders).
    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateInvoiceDto dto)
    {
        try
        {
            var result = await _invoices.CreateInvoiceAsync(dto);
            await NotifyKitchenAsync(result);
            // 201 con el cuerpo (sin Location: el creador es anónimo y GetById es solo admin).
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creando invoice");
            return StatusCode(500, new { error = "Error al crear la factura" });
        }
    }

    /// <summary>Notifica a cada KDS las órdenes recién creadas (mismo evento que OrderController).
    /// El KDS ya trae poll de respaldo de 5s; esto las hace aparecer al instante + con toast.</summary>
    private async Task NotifyKitchenAsync(InvoiceDto invoice)
    {
        foreach (var o in invoice.Orders)
        {
            try
            {
                await _kitchenHub.Clients.Group("kitchen").SendAsync("NewKitchenOrder", new
                {
                    orderId = o.OrderId,
                    orderNumber = o.OrderNumber,
                    restaurantId = o.RestaurantId,   // para el ruteo por franquicia del KDS
                    items = o.Items.Select(i => new { i.DishId, i.DishName, i.Quantity }).ToList<object>(),
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo notificar a cocina para orden {OrderId}", o.OrderId);
            }
        }
    }

    // GET /api/invoices/{id}
    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(int id)
    {
        var invoice = await _invoices.GetInvoiceByIdAsync(id);
        return invoice == null ? NotFound(new { error = "Factura no encontrada" }) : Ok(invoice);
    }

    // GET /api/invoices/tracking?status=OutForDelivery — seguimiento del admin y del REPARTIDOR
    // (delivery-app). Gate por el switch DeliveryTrackingEnabled (permiso del admin).
    [HttpGet("tracking")]
    [Authorize(Roles = "Admin,Manager,Delivery")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Tracking([FromQuery] string? status)
    {
        if (!await IsTrackingEnabledAsync())
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "El seguimiento de órdenes está deshabilitado por el administrador." });

        return Ok(await _invoices.GetTrackingAsync(status));
    }

    /// <summary>Transiciones que puede hacer el ROL Delivery (repartidor): recoger y entregar.
    /// Los estados tempranos (Confirmed/Preparing/ReadyForPickup) los maneja admin/manager.</summary>
    private static readonly Dictionary<string, string[]> DriverAllowedTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["OutForDelivery"] = new[] { "ReadyForPickup" },
        ["Delivered"]      = new[] { "OutForDelivery" },
    };

    // PUT /api/invoices/{id}/delivery-status — avanzar el tracking (Confirmed, OutForDelivery, Delivered…).
    // El repartidor (rol Delivery) solo puede ReadyForPickup→OutForDelivery y OutForDelivery→Delivered.
    [HttpPut("{id:int}/delivery-status")]
    [Authorize(Roles = "Admin,Manager,Delivery")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateDeliveryStatus(int id, [FromBody] UpdateDeliveryStatusDto body)
    {
        if (!await IsTrackingEnabledAsync())
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "El seguimiento de órdenes está deshabilitado por el administrador." });
        try
        {
            var newStatus = body?.Status ?? "";
            if (User.IsInRole("Delivery") && !User.IsInRole("Admin") && !User.IsInRole("Manager"))
            {
                if (!DriverAllowedTransitions.TryGetValue(newStatus, out var validFrom))
                    return StatusCode(StatusCodes.Status403Forbidden,
                        new { error = "El repartidor solo puede marcar 'En camino' o 'Entregado'." });

                var current = await _invoices.GetInvoiceByIdAsync(id);
                if (current == null) return NotFound(new { error = "Factura no encontrada" });
                if (!validFrom.Contains(current.DeliveryStatus, StringComparer.OrdinalIgnoreCase))
                    return StatusCode(StatusCodes.Status403Forbidden,
                        new { error = $"Transición no permitida para el repartidor: {current.DeliveryStatus} → {newStatus}." });
            }

            return Ok(await _invoices.UpdateDeliveryStatusAsync(id, newStatus));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // GET /api/invoices/tracking-settings — estado del switch (para pintar el toggle del admin).
    [HttpGet("tracking-settings")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTrackingSettings()
        => Ok(new { deliveryTrackingEnabled = await IsTrackingEnabledAsync() });

    // PUT /api/invoices/tracking-settings — el admin habilita/oculta el tracking (como el plano).
    [HttpPut("tracking-settings")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetTrackingSettings([FromBody] TrackingSettingsDto body)
    {
        var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.IsActive)
                         ?? await _context.Restaurants.FirstOrDefaultAsync();
        if (restaurant == null) return NotFound(new { error = "Restaurante no encontrado" });

        if (body?.Enabled.HasValue == true) restaurant.DeliveryTrackingEnabled = body.Enabled.Value;
        restaurant.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { deliveryTrackingEnabled = restaurant.DeliveryTrackingEnabled });
    }

    /// <summary>Switch del dueño (nivel restaurante activo). Default true si no hay restaurante.</summary>
    private async Task<bool> IsTrackingEnabledAsync()
    {
        var cfg = await _context.Restaurants
            .Where(r => r.IsActive)
            .Select(r => (bool?)r.DeliveryTrackingEnabled)
            .FirstOrDefaultAsync();
        return cfg ?? true;
    }

    public class TrackingSettingsDto
    {
        public bool? Enabled { get; set; }
    }
}
