using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Application.Common;
using System.Text.Json;

namespace SmartMenu.API.Controllers;

/// <summary>
/// Plano de planta (Gestión de Salón): lee/persiste el LAYOUT diseñado (posiciones,
/// formas, estructuras) + devuelve el estado dinámico de cada mesa por zona. El estado
/// en vivo se difunde aparte por el hub /hubs/tables (TableStatusChanged).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FloorPlanController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FloorPlanController> _logger;

    public FloorPlanController(ApplicationDbContext context, ILogger<FloorPlanController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>Zona de salón (no cocina/bar) — igual criterio que host-app.</summary>
    private static bool IsDiningZone(string? type)
    {
        var t = (type ?? "").Trim().ToLowerInvariant();
        return t != "kitchen" && t != "bar";
    }

    // GET /api/floorplan → FloorPlanData (zonas → mesas con layout + status + estructuras)
    [HttpGet]
    [Authorize(Roles = "Admin,Manager,Waiter,Host")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFloorPlan()
    {
        try
        {
            var diningZones = (await _context.Zones.AsNoTracking()
                    .Where(z => z.IsActive)
                    .ToListAsync())
                .Where(z => IsDiningZone(z.Type))
                .ToList();
            var zoneIds = diningZones.Select(z => z.Id).ToList();

            var tables = await _context.Tables.AsNoTracking()
                .Where(t => zoneIds.Contains(t.ZoneId))
                .ToListAsync();

            var structures = await _context.FloorStructures.AsNoTracking()
                .Where(s => zoneIds.Contains(s.ZoneId))
                .ToListAsync();

            // Status dinámico: una mesa Available con reserva activa solapando [ahora, ahora+60min]
            // se muestra como Reserved (misma lógica que TableController.GetTables, pero en memoria).
            var nowLocal = RestaurantClock.Now;
            var horizon = nowLocal.AddMinutes(60);
            var reservedTableIds = (await _context.TableReservations.AsNoTracking()
                    .Where(r => ReservationMath.ActiveStatuses.Contains(r.Status)
                             && r.TableId != null
                             && r.ReservationDateTime < horizon
                             && nowLocal < r.EndDateTime)
                    .Select(r => r.TableId!.Value)
                    .Distinct()
                    .ToListAsync())
                .ToHashSet();

            // Estados en minúscula para alinear con TableData.status del plano (@smartmenu/ui).
            string EffectiveStatus(Table t)
            {
                if (t.Status == TableStatus.Available && reservedTableIds.Contains(t.Id)) return "reserved";
                if (t.Status == TableStatus.Reserved && !reservedTableIds.Contains(t.Id)) return "available";
                return t.Status.ToString().ToLowerInvariant();
            }

            // Mesero EN VIVO a cargo: SOLO en mesas que se están atendiendo (ocupada/por cobrar),
            // así el badge nunca queda pegado en una mesa liberada con la sesión sin cerrar.
            // Prioridad por mesa: sesión activa con waiter → si no, orden viva con waiter.
            var servedTableIds = tables
                .Where(t => EffectiveStatus(t) is "occupied" or "billing")
                .Select(t => t.Id).ToList();
            var waiterByTable = new Dictionary<int, (string? First, string? Last)>();
            if (servedTableIds.Count > 0)
            {
                var sessionWaiters = await _context.TableSessions.AsNoTracking()
                    .Where(ts => ts.IsActive && servedTableIds.Contains(ts.TableId) && ts.AssignedWaiterId != null)
                    .Select(ts => new { ts.TableId, ts.AssignedWaiter!.FirstName, ts.AssignedWaiter.LastName })
                    .ToListAsync();
                foreach (var w in sessionWaiters)
                    waiterByTable.TryAdd(w.TableId, (w.FirstName, w.LastName));

                var pendingTableIds = servedTableIds.Where(id => !waiterByTable.ContainsKey(id)).ToList();
                if (pendingTableIds.Count > 0)
                {
                    var orderWaiters = await _context.Orders.AsNoTracking()
                        .Where(o => o.TableId != null && pendingTableIds.Contains(o.TableId.Value)
                                 && o.AssignedWaiterId != null
                                 && o.Status != OrderStatus.Completed && o.Status != OrderStatus.Cancelled)
                        .OrderByDescending(o => o.Id)
                        .Select(o => new { TableId = o.TableId!.Value, o.AssignedWaiter!.FirstName, o.AssignedWaiter.LastName })
                        .ToListAsync();
                    foreach (var w in orderWaiters)
                        waiterByTable.TryAdd(w.TableId, (w.FirstName, w.LastName));
                }
            }

            var waiterInfo = waiterByTable.ToDictionary(
                kv => kv.Key,
                kv => (Initials: NameFormatting.Initials(kv.Value.First, kv.Value.Last),
                       Name: NameFormatting.FullName(kv.Value.First, kv.Value.Last)));

            var paletteJson = await _context.Restaurants
                .Where(r => r.IsActive)
                .Select(r => r.FloorPlanPaletteJson)
                .FirstOrDefaultAsync();
            Dictionary<string, string>? palette = null;
            if (!string.IsNullOrWhiteSpace(paletteJson))
            {
                try { palette = JsonSerializer.Deserialize<Dictionary<string, string>>(paletteJson); } catch { }
            }

            var result = new
            {
                palette,
                zones = diningZones.Select(z => new
                {
                    zoneId = z.Id.ToString(),
                    zoneName = z.Name,
                    tables = tables.Where(t => t.ZoneId == z.Id).Select(t => new
                    {
                        id = t.Id,
                        number = t.TableNumber,
                        x = t.PositionX,
                        y = t.PositionY,
                        status = EffectiveStatus(t),
                        shape = t.Shape,
                        width = t.Width,
                        height = t.Height,
                        capacity = t.Capacity,
                        server = t.Server,
                        name = t.Name,
                        color = t.Color,
                        waiter = waiterInfo.TryGetValue(t.Id, out var wi) ? wi.Initials : null,
                        waiterName = waiterInfo.TryGetValue(t.Id, out var wn) ? wn.Name : null,
                    }),
                    structures = structures.Where(s => s.ZoneId == z.Id).Select(s => new
                    {
                        id = s.Id.ToString(),
                        type = s.Type,
                        x = s.X,
                        y = s.Y,
                        width = s.Width,
                        height = s.Height,
                        label = s.Label,
                    }),
                }),
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting floor plan");
            return StatusCode(500, new { error = "Error al obtener el plano" });
        }
    }

    // PUT /api/floorplan → persiste SOLO el layout (posiciones/formas/server por mesa + estructuras por zona).
    [HttpPut]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveFloorPlan([FromBody] FloorPlanDto body)
    {
        try
        {
            if (body?.Zones == null) return BadRequest(new { error = "Payload inválido" });

            foreach (var zone in body.Zones)
            {
                if (!int.TryParse(zone.ZoneId, out var zoneId)) continue;

                // Mesas: actualizar solo campos de layout (match por id real de la mesa).
                var dtoTables = zone.Tables ?? new List<TableLayoutDto>();
                var ids = dtoTables.Select(t => t.Id).ToList();
                if (ids.Count > 0)
                {
                    var dbTables = await _context.Tables.Where(t => ids.Contains(t.Id)).ToListAsync();
                    foreach (var dto in dtoTables)
                    {
                        var t = dbTables.FirstOrDefault(x => x.Id == dto.Id);
                        if (t == null) continue;
                        t.PositionX = dto.X;
                        t.PositionY = dto.Y;
                        t.Shape = dto.Shape;
                        t.Width = dto.Width;
                        t.Height = dto.Height;
                        t.Server = dto.Server;
                        t.Name = dto.Name;
                        t.Color = dto.Color;
                        if (dto.Capacity.HasValue) t.Capacity = dto.Capacity.Value;
                        t.UpdatedAt = DateTime.UtcNow;
                    }
                }

                // Estructuras: estrategia "reemplazar" las de la zona.
                var existing = await _context.FloorStructures.Where(s => s.ZoneId == zoneId).ToListAsync();
                if (existing.Count > 0) _context.FloorStructures.RemoveRange(existing);
                foreach (var s in zone.Structures ?? new List<StructureLayoutDto>())
                {
                    _context.FloorStructures.Add(new FloorStructure
                    {
                        ZoneId = zoneId,
                        Type = string.IsNullOrWhiteSpace(s.Type) ? "wall" : s.Type!,
                        X = s.X,
                        Y = s.Y,
                        Width = s.Width,
                        Height = s.Height,
                        Label = s.Label,
                    });
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Plano guardado correctamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving floor plan");
            return StatusCode(500, new { error = "Error al guardar el plano" });
        }
    }

    // PUT /api/floorplan/palette → paleta de colores de estado del restaurante (fill por estado).
    [HttpPut("palette")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SavePalette([FromBody] PaletteDto body)
    {
        try
        {
            var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.IsActive)
                             ?? await _context.Restaurants.FirstOrDefaultAsync();
            if (restaurant == null) return NotFound(new { error = "Restaurante no encontrado" });
            restaurant.FloorPlanPaletteJson = (body?.StatusColors != null && body.StatusColors.Count > 0)
                ? JsonSerializer.Serialize(body.StatusColors)
                : null;
            restaurant.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Paleta guardada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving palette");
            return StatusCode(500, new { error = "Error al guardar la paleta" });
        }
    }

    // ── DTOs del PUT (espejo de FloorPlanData de @smartmenu/ui) ──
    public class FloorPlanDto
    {
        public List<ZoneLayoutDto> Zones { get; set; } = new();
    }

    public class ZoneLayoutDto
    {
        public string ZoneId { get; set; } = "";
        public List<TableLayoutDto>? Tables { get; set; }
        public List<StructureLayoutDto>? Structures { get; set; }
    }

    public class TableLayoutDto
    {
        public int Id { get; set; }
        public double? X { get; set; }
        public double? Y { get; set; }
        public string? Shape { get; set; }
        public double? Width { get; set; }
        public double? Height { get; set; }
        public string? Server { get; set; }
        public string? Name { get; set; }
        public string? Color { get; set; }
        public int? Capacity { get; set; }
    }

    public class StructureLayoutDto
    {
        public string? Type { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double? Width { get; set; }
        public double? Height { get; set; }
        public string? Label { get; set; }
    }

    public class PaletteDto
    {
        public Dictionary<string, string>? StatusColors { get; set; }
    }
}
