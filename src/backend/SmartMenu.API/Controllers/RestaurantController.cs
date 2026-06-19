using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

/// <summary>
/// Sprint 5.2 — gestión de configuración a nivel restaurante.
///
/// Endpoints:
///   GET  /api/restaurant            — lista restaurantes activos (Admin)
///   GET  /api/restaurant/{id}       — detalle (Admin/Manager)
///   GET  /api/restaurant/current    — el restaurante del usuario logueado
///   PUT  /api/restaurant/{id}/auth-mode — cambiar WaiterAuthMode
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RestaurantController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RestaurantController> _logger;
    private readonly SmartMenu.Application.Services.IAuditService _audit;

    public RestaurantController(
        ApplicationDbContext context,
        ILogger<RestaurantController> logger,
        SmartMenu.Application.Services.IAuditService audit)
    {
        _context = context;
        _logger = logger;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetAll()
    {
        var list = await _context.Restaurants
            .AsNoTracking()
            .Where(r => r.IsActive)
            .Select(r => new
            {
                id = r.Id,
                name = r.Name,
                address = r.Address,
                phone = r.Phone,
                email = r.Email,
                rnc = r.RNC,
                logo = r.Logo,
                isActive = r.IsActive,
                waiterAuthMode = (int)r.WaiterAuthMode,
                waiterAuthModeName = r.WaiterAuthMode.ToString(),
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetById(int id)
    {
        var r = await _context.Restaurants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return NotFound(new { error = "Restaurante no encontrado" });
        return Ok(new
        {
            id = r.Id, name = r.Name, address = r.Address, phone = r.Phone, email = r.Email,
            rnc = r.RNC, logo = r.Logo, isActive = r.IsActive,
            waiterAuthMode = (int)r.WaiterAuthMode,
            waiterAuthModeName = r.WaiterAuthMode.ToString(),
        });
    }

    /// <summary>
    /// Devuelve el restaurante actual (basado en el RestaurantId del user logueado).
    /// Si el user no tiene restaurantId asignado, devuelve el primero activo.
    /// </summary>
    [HttpGet("current")]
    [Authorize]
    public async Task<IActionResult> GetCurrent()
    {
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;
        int.TryParse(sub, out var userId);
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        var rid = user?.RestaurantId;
        var r = rid.HasValue
            ? await _context.Restaurants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == rid)
            : await _context.Restaurants.AsNoTracking().FirstOrDefaultAsync(x => x.IsActive);
        if (r == null) return NotFound(new { error = "No hay restaurante configurado" });
        return Ok(new
        {
            id = r.Id, name = r.Name, address = r.Address, phone = r.Phone, email = r.Email,
            rnc = r.RNC, logo = r.Logo, isActive = r.IsActive,
            waiterAuthMode = (int)r.WaiterAuthMode,
            waiterAuthModeName = r.WaiterAuthMode.ToString(),
        });
    }

    /// <summary>
    /// Cambia el modo de autenticación del waiter para este restaurante.
    /// Solo Admin/Manager. Valores válidos: 0=PrivateOnly, 1=PublicPin, 2=Hybrid.
    /// Audita la acción para trazabilidad DGII.
    /// </summary>
    [HttpPut("{id}/auth-mode")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> SetAuthMode(int id, [FromBody] SetAuthModeDto dto)
    {
        if (dto == null) return BadRequest(new { error = "Cuerpo requerido" });
        if (!Enum.IsDefined(typeof(WaiterAuthMode), dto.Mode))
            return BadRequest(new { error = $"Modo inválido. Valores: 0 (PrivateOnly), 1 (PublicPin), 2 (Hybrid)" });

        var r = await _context.Restaurants.FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return NotFound(new { error = "Restaurante no encontrado" });

        var prev = r.WaiterAuthMode;
        var newMode = (WaiterAuthMode)dto.Mode;
        if (prev == newMode)
            return Ok(new { message = "Sin cambios", waiterAuthMode = (int)r.WaiterAuthMode });

        r.WaiterAuthMode = newMode;
        await _context.SaveChangesAsync();

        // Auditar
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;
        int.TryParse(sub, out var actorId);
        var authMethod = User.FindFirst("auth_method")?.Value ?? "password";
        await _audit.LogAsync(
            userId: actorId,
            action: "Restaurant.WaiterAuthMode.Changed",
            entityType: "Restaurant",
            entityId: r.Id,
            ip: HttpContext.Connection.RemoteIpAddress?.ToString(),
            authMethod: authMethod,
            metadata: new { previousMode = prev.ToString(), newMode = newMode.ToString() });

        _logger.LogInformation(
            "WaiterAuthMode for restaurant {RestaurantId} changed from {Prev} to {New} by user {ActorId}",
            r.Id, prev, newMode, actorId);

        return Ok(new
        {
            message = "Modo actualizado",
            waiterAuthMode = (int)r.WaiterAuthMode,
            waiterAuthModeName = r.WaiterAuthMode.ToString()
        });
    }
}

public class SetAuthModeDto
{
    /// <summary>0=PrivateOnly, 1=PublicPin, 2=Hybrid</summary>
    public int Mode { get; set; }
}
