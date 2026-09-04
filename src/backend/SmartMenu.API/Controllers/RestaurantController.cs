using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

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

    [HttpPut("{id}/location")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> SetLocation(int id, [FromBody] SetLocationDto dto)
    {
        if (dto?.Latitude is not double lat || dto.Longitude is not double lng
            || lat < -90 || lat > 90 || lng < -180 || lng > 180)
            return BadRequest(new { error = "Coordenadas inválidas (latitude [-90,90], longitude [-180,180])." });

        var r = await _context.Restaurants.FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return NotFound(new { error = "Restaurante no encontrado" });

        r.Latitude = lat;
        r.Longitude = lng;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Ubicación del restaurante {RestaurantId} configurada: {Lat}, {Lng}", r.Id, lat, lng);
        return Ok(new { message = "Ubicación actualizada", latitude = r.Latitude, longitude = r.Longitude });
    }
}

public class SetAuthModeDto
{

    public int Mode { get; set; }
}

public class SetLocationDto
{
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
