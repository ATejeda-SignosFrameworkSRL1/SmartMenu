using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class ZoneController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ZoneController> _logger;

    public ZoneController(ApplicationDbContext context, ILogger<ZoneController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllZones([FromQuery] string? type)
    {
        try
        {
            var query = _context.Zones.Where(z => z.IsActive);

            if (!string.IsNullOrEmpty(type))
                query = query.Where(z => z.Type == type);

            var zones = await query
                .Select(z => new
                {
                    z.Id,
                    z.Name,
                    z.Type,
                    z.Description,
                    z.RestaurantId,
                    z.IsActive,
                    TableCount = z.Tables.Count,
                    AvailableTables = z.Tables.Count(t => t.Status == Domain.Enums.TableStatus.Available)
                })
                .ToListAsync();

            return Ok(zones);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting zones");
            return StatusCode(500, new { error = "Error al obtener zonas" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetZoneById(int id)
    {
        try
        {
            var zone = await _context.Zones
                .Include(z => z.Tables)
                .Where(z => z.Id == id)
                .Select(z => new
                {
                    z.Id,
                    z.Name,
                    z.Type,
                    z.Description,
                    z.RestaurantId,
                    z.IsActive,
                    Tables = z.Tables.Select(t => new
                    {
                        t.Id,
                        t.TableNumber,
                        t.Capacity,
                        Status = t.Status.ToString(),
                        t.QRCode
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (zone == null)
                return NotFound(new { error = "Zona no encontrada" });

            return Ok(zone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting zone {ZoneId}", id);
            return StatusCode(500, new { error = "Error al obtener zona" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateZone([FromBody] CreateZoneDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { error = "El nombre es requerido" });

            var validTypes = new[] { "Dining", "Kitchen", "Bar" };
            var zoneType = validTypes.FirstOrDefault(t => t.Equals(dto.Type, StringComparison.OrdinalIgnoreCase)) ?? "Dining";

            var zone = new Zone
            {
                Name = dto.Name.Trim(),
                Type = zoneType,
                Description = dto.Description?.Trim(),
                RestaurantId = dto.RestaurantId > 0 ? dto.RestaurantId : 1,
                IsActive = true
            };

            _context.Zones.Add(zone);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Zone {ZoneId} created: {Name} ({Type})", zone.Id, zone.Name, zone.Type);

            return Created($"/api/zone/{zone.Id}", new
            {
                zone.Id,
                zone.Name,
                zone.Type,
                zone.Description,
                zone.RestaurantId,
                zone.IsActive,
                tableCount = 0,
                message = "Zona creada exitosamente"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating zone");
            return StatusCode(500, new { error = "Error al crear zona" });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateZone(int id, [FromBody] UpdateZoneDto dto)
    {
        try
        {
            var zone = await _context.Zones.FindAsync(id);
            if (zone == null)
                return NotFound(new { error = "Zona no encontrada" });

            if (!string.IsNullOrWhiteSpace(dto.Name))
                zone.Name = dto.Name.Trim();

            if (dto.Description != null)
                zone.Description = dto.Description.Trim();

            if (!string.IsNullOrWhiteSpace(dto.Type))
            {
                var validTypes = new[] { "Dining", "Kitchen", "Bar" };
                var zoneType = validTypes.FirstOrDefault(t => t.Equals(dto.Type, StringComparison.OrdinalIgnoreCase));
                if (zoneType != null) zone.Type = zoneType;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                zone.Id,
                zone.Name,
                zone.Type,
                zone.Description,
                message = "Zona actualizada correctamente"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating zone {ZoneId}", id);
            return StatusCode(500, new { error = "Error al actualizar zona" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteZone(int id)
    {
        try
        {
            var zone = await _context.Zones
                .Include(z => z.Tables)
                .FirstOrDefaultAsync(z => z.Id == id);

            if (zone == null)
                return NotFound(new { error = "Zona no encontrada" });

            if (zone.Tables.Any())
                return BadRequest(new { error = "No se puede eliminar una zona que tiene mesas asignadas. Elimina o mueve las mesas primero." });

            _context.Zones.Remove(zone);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Zone {ZoneId} deleted", id);
            return Ok(new { message = "Zona eliminada correctamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting zone {ZoneId}", id);
            return StatusCode(500, new { error = "Error al eliminar zona" });
        }
    }

    [HttpPut("{id}/toggle")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        try
        {
            var zone = await _context.Zones.FindAsync(id);
            if (zone == null)
                return NotFound(new { error = "Zona no encontrada" });

            zone.IsActive = !zone.IsActive;
            await _context.SaveChangesAsync();

            return Ok(new { zone.Id, zone.IsActive, message = zone.IsActive ? "Zona activada" : "Zona desactivada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling zone {ZoneId}", id);
            return StatusCode(500, new { error = "Error al cambiar estado" });
        }
    }
}

public class CreateZoneDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "Dining";
    public string? Description { get; set; }
    public int RestaurantId { get; set; } = 1;
}

public class UpdateZoneDto
{
    public string? Name { get; set; }
    public string? Type { get; set; }
    public string? Description { get; set; }
}
