using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.API.Hubs;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

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

    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("invoices")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateInvoiceDto dto)
    {
        try
        {
            var result = await _invoices.CreateInvoiceAsync(dto);
            await NotifyKitchenAsync(result);

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
                    restaurantId = o.RestaurantId,
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

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(int id)
    {
        var invoice = await _invoices.GetInvoiceByIdAsync(id);
        return invoice == null ? NotFound(new { error = "Factura no encontrada" }) : Ok(invoice);
    }

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

    private static readonly Dictionary<string, string[]> DriverAllowedTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["OutForDelivery"] = new[] { "ReadyForPickup" },
        ["Delivered"]      = new[] { "OutForDelivery" },
    };

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
            string[]? allowedCurrent = null;
            if (User.IsInRole("Delivery") && !User.IsInRole("Admin") && !User.IsInRole("Manager"))
            {
                if (!DriverAllowedTransitions.TryGetValue(newStatus, out var validFrom))
                    return StatusCode(StatusCodes.Status403Forbidden,
                        new { error = "El repartidor solo puede marcar 'En camino' o 'Entregado'." });

                allowedCurrent = validFrom;
            }

            return Ok(await _invoices.UpdateDeliveryStatusAsync(id, newStatus, allowedCurrent));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}/driver-location")]
    [Authorize(Roles = "Admin,Manager,Delivery")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateDriverLocation(int id, [FromBody] DriverLocationDto body)
    {

        if (!await IsTrackingEnabledAsync())
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "El seguimiento de órdenes está deshabilitado por el administrador." });

        if (body?.Lat is not double lat || body.Lng is not double lng
            || lat < -90 || lat > 90 || lng < -180 || lng > 180)
            return BadRequest(new { error = "Coordenadas inválidas." });
        try
        {
            var updated = await _invoices.UpdateDriverLocationAsync(id, lat, lng);
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("tracking-settings")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTrackingSettings()
        => Ok(new { deliveryTrackingEnabled = await IsTrackingEnabledAsync() });

    [HttpPut("tracking-settings")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetTrackingSettings([FromBody] TrackingSettingsDto body)
    {

        var restaurant = await _context.Restaurants.Where(r => r.IsActive).OrderBy(r => r.Id).FirstOrDefaultAsync()
                         ?? await _context.Restaurants.OrderBy(r => r.Id).FirstOrDefaultAsync();
        if (restaurant == null) return NotFound(new { error = "Restaurante no encontrado" });

        if (body?.Enabled.HasValue == true) restaurant.DeliveryTrackingEnabled = body.Enabled.Value;
        restaurant.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { deliveryTrackingEnabled = restaurant.DeliveryTrackingEnabled });
    }

    private async Task<bool> IsTrackingEnabledAsync()
    {

        var cfg = await _context.Restaurants
            .Where(r => r.IsActive)
            .OrderBy(r => r.Id)
            .Select(r => (bool?)r.DeliveryTrackingEnabled)
            .FirstOrDefaultAsync();
        return cfg ?? true;
    }

    public class TrackingSettingsDto
    {
        public bool? Enabled { get; set; }
    }
}
