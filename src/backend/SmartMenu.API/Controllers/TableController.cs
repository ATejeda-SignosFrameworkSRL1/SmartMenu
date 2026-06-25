using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Enums;
using SmartMenu.API.Hubs;
using SmartMenu.Application.Common;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TableController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TableController> _logger;
    private readonly IHubContext<TableHub> _tableHub;

    public TableController(ApplicationDbContext context, ILogger<TableController> logger, IHubContext<TableHub> tableHub)
    {
        _context = context;
        _logger = logger;
        _tableHub = tableHub;
    }

    /// <summary>
    /// Obtener todas las mesas. AllowAnonymous porque el customer-app las usa
    /// para mostrar el listado de QR codes (no devuelve PII — solo número,
    /// zona, capacidad, status, qrCode).
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTables()
    {
        try
        {
            // Capacidad dinámica por intervalo: una mesa está Reserved solo si tiene una reserva
            // ACTIVA asignada cuya VENTANA DE BLOQUEO ya empezó (ReservationDateTime - AdvanceBlockMinutes
            // <= ahora < EndDateTime) — ya NO se bloquea el día completo. AdvanceBlockMinutes es POR reserva
            // (default 60); se filtra en memoria porque EF Core no traduce AddMinutes(-columna).
            // Hora local del restaurante (las reservas se guardan naive-local).
            var nowLocal = RestaurantClock.Now;
            var reservedTableIds = (await _context.TableReservations
                .Where(r => ReservationMath.ActiveStatuses.Contains(r.Status)
                         && r.TableId != null
                         && nowLocal < r.EndDateTime)
                .Select(r => new { TableId = r.TableId!.Value, r.ReservationDateTime, r.AdvanceBlockMinutes })
                .ToListAsync())
                .Where(r => nowLocal >= r.ReservationDateTime.AddMinutes(-r.AdvanceBlockMinutes))
                .Select(r => r.TableId)
                .Distinct()
                .ToList();

            // S2.2 (QA-fix) — read-only: un GET NO debe escribir Status. Se calcula el estado
            // EFECTIVO en memoria (Reserved↔Available según la ventana de reserva), igual que
            // FloorPlanController; la persistencia de Reserved la maneja el flujo de reservas.
            var tables = await _context.Tables
                .AsNoTracking()
                .Include(t => t.Zone)
                .ToListAsync();

            var result = tables.Select(t => new
            {
                id = t.Id,
                tableNumber = t.TableNumber,
                capacity = t.Capacity,
                zoneName = t.Zone?.Name,
                status = (t.Status == TableStatus.Available && reservedTableIds.Contains(t.Id)) ? nameof(TableStatus.Reserved)
                       : (t.Status == TableStatus.Reserved && !reservedTableIds.Contains(t.Id)) ? nameof(TableStatus.Available)
                       : t.Status.ToString(),
                qrCode = t.QRCode,
                name = t.Name,
                color = t.Color,
                shape = t.Shape
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tables");
            return StatusCode(500, new { error = "Error al obtener mesas" });
        }
    }

    /// <summary>
    /// Obtener mesa por ID
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTable(int id)
    {
        try
        {
            var table = await _context.Tables
                .Include(t => t.Zone)
                .Where(t => t.Id == id)
                .Select(t => new
                {
                    id = t.Id,
                    tableNumber = t.TableNumber,
                    capacity = t.Capacity,
                    zoneName = t.Zone.Name,
                    status = t.Status.ToString(),
                    qrCode = t.QRCode,
                    restaurantId = t.RestaurantId
                })
                .FirstOrDefaultAsync();

            if (table == null)
                return NotFound(new { message = "Mesa no encontrada" });

            return Ok(table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting table {TableId}", id);
            return StatusCode(500, new { error = "Error al obtener mesa" });
        }
    }

    /// <summary>
    /// Obtener mesa por código QR
    /// </summary>
    [HttpGet("qr/{qrCode}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTableByQR(string qrCode)
    {
        try
        {
            var table = await _context.Tables
                .Include(t => t.Zone)
                .Where(t => t.QRCode == qrCode)
                .Select(t => new
                {
                    id = t.Id,
                    tableNumber = t.TableNumber,
                    capacity = t.Capacity,
                    zoneName = t.Zone.Name,
                    status = t.Status.ToString(),
                    qrCode = t.QRCode,
                    restaurantId = t.RestaurantId
                })
                .FirstOrDefaultAsync();

            if (table == null)
                return NotFound(new { message = "Mesa no encontrada" });

            return Ok(table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting table by QR {QRCode}", qrCode);
            return StatusCode(500, new { error = "Error al obtener mesa" });
        }
    }

    /// <summary>
    /// Crear mesa (genera QR automáticamente)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateTable([FromBody] CreateTableDto dto)
    {
        try
        {
            var zone = await _context.Zones.FindAsync(dto.ZoneId);
            if (zone == null)
                return BadRequest(new { error = "Zona no encontrada" });

            var table = new SmartMenu.Domain.Entities.Table
            {
                TableNumber = dto.TableNumber,
                Capacity = dto.Capacity,
                ZoneId = dto.ZoneId,
                RestaurantId = zone.RestaurantId,
                Status = TableStatus.Available,
                QRCode = Guid.NewGuid().ToString("N"),
                Name = string.IsNullOrWhiteSpace(dto.Name) ? null : dto.Name!.Trim(),
                Color = string.IsNullOrWhiteSpace(dto.Color) ? null : dto.Color!.Trim(),
                Shape = string.IsNullOrWhiteSpace(dto.Shape) ? null : dto.Shape
            };

            _context.Tables.Add(table);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Table {TableId} created with QR {QR}", table.Id, table.QRCode);

            try
            {
                await _tableHub.Clients.All.SendAsync("TableStatusChanged", new
                {
                    tableId = table.Id,
                    status = "Available",
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception exHub)
            {
                _logger.LogWarning(exHub, "No se pudo notificar por SignalR");
            }

            return Created($"/api/table/{table.Id}", new
            {
                id = table.Id,
                tableNumber = table.TableNumber,
                capacity = table.Capacity,
                zoneId = table.ZoneId,
                zoneName = zone.Name,
                status = "Available",
                qrCode = table.QRCode,
                message = "Mesa creada exitosamente"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating table");
            return StatusCode(500, new { error = "Error al crear mesa" });
        }
    }

    /// <summary>
    /// Editar mesa
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateTable(int id, [FromBody] UpdateTableDto dto)
    {
        try
        {
            var table = await _context.Tables.Include(t => t.Zone).FirstOrDefaultAsync(t => t.Id == id);
            if (table == null)
                return NotFound(new { message = "Mesa no encontrada" });

            if (dto.TableNumber.HasValue) table.TableNumber = dto.TableNumber.Value;
            if (dto.Capacity.HasValue) table.Capacity = dto.Capacity.Value;
            if (dto.Name != null) table.Name = string.IsNullOrWhiteSpace(dto.Name) ? null : dto.Name.Trim();
            if (dto.Color != null) table.Color = string.IsNullOrWhiteSpace(dto.Color) ? null : dto.Color.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Shape)) table.Shape = dto.Shape;
            if (dto.ZoneId.HasValue)
            {
                var zone = await _context.Zones.FindAsync(dto.ZoneId.Value);
                if (zone == null) return BadRequest(new { error = "Zona no encontrada" });
                table.ZoneId = dto.ZoneId.Value;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = table.Id,
                tableNumber = table.TableNumber,
                capacity = table.Capacity,
                zoneName = table.Zone.Name,
                status = table.Status.ToString(),
                qrCode = table.QRCode,
                name = table.Name,
                color = table.Color,
                shape = table.Shape,
                message = "Mesa actualizada correctamente"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating table {TableId}", id);
            return StatusCode(500, new { error = "Error al actualizar mesa" });
        }
    }

    /// <summary>
    /// Eliminar mesa
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTable(int id)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
                return NotFound(new { message = "Mesa no encontrada" });

            if (table.Status == TableStatus.Occupied)
                return BadRequest(new { error = "No se puede eliminar una mesa ocupada" });

            _context.Tables.Remove(table);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Table {TableId} deleted", id);

            return Ok(new { message = "Mesa eliminada correctamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting table {TableId}", id);
            return StatusCode(500, new { error = "Error al eliminar mesa" });
        }
    }

    /// <summary>
    /// Regenerar QR de una mesa
    /// </summary>
    [HttpPut("{id}/regenerate-qr")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegenerateQR(int id)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
                return NotFound(new { message = "Mesa no encontrada" });

            table.QRCode = Guid.NewGuid().ToString("N");
            await _context.SaveChangesAsync();

            return Ok(new { id = table.Id, qrCode = table.QRCode, message = "QR regenerado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error regenerating QR for table {TableId}", id);
            return StatusCode(500, new { error = "Error al regenerar QR" });
        }
    }

    /// <summary>
    /// Actualizar estado de mesa
    /// </summary>
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateTableStatus(int id, [FromBody] UpdateTableStatusDto dto)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
                return NotFound(new { message = "Mesa no encontrada" });

            // Parsear y validar estado
            if (!Enum.TryParse<TableStatus>(dto.NewStatus, true, out var newStatus))
                return BadRequest(new { error = "Estado inválido" });

            table.Status = newStatus;

            // Al liberar mesa (Available), cerrar sesión activa si existe
            if (newStatus == TableStatus.Available)
            {
                var activeSession = await _context.TableSessions
                    .FirstOrDefaultAsync(ts => ts.TableId == id && ts.IsActive);
                if (activeSession != null)
                {
                    activeSession.IsActive = false;
                    activeSession.EndTime = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Table {TableId} status updated to {Status}", id, dto.NewStatus);

            try
            {
                await _tableHub.Clients.All.SendAsync("TableStatusChanged", new
                {
                    tableId = id,
                    status = dto.NewStatus,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception exHub)
            {
                _logger.LogWarning(exHub, "No se pudo notificar TableStatusChanged por SignalR");
            }

            return Ok(new
            {
                message = "Estado actualizado correctamente",
                tableId = id,
                newStatus = dto.NewStatus
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating table status for {TableId}", id);
            return StatusCode(500, new { error = "Error al actualizar estado" });
        }
    }

    /// <summary>
    /// Obtener URL del menú para la mesa (para generar QR y pegar en mesa). El cliente escanea y va al menú con tableId asignado.
    /// </summary>
    [HttpGet("{id}/menu-url")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTableMenuUrl(int id, [FromQuery] string? baseUrl)
    {
        var table = await _context.Tables.FindAsync(id);
        if (table == null)
            return NotFound(new { message = "Mesa no encontrada" });
        var path = $"table/table-{table.Id}";
        var url = !string.IsNullOrEmpty(baseUrl) ? $"{baseUrl.TrimEnd('/')}/{path}" : path;
        return Ok(new { tableId = table.Id, tableNumber = table.TableNumber, menuPath = path, fullUrl = url });
    }

    /// <summary>
    /// Obtener mesas por zona
    /// </summary>
    [HttpGet("zone/{zoneId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTablesByZone(int zoneId)
    {
        try
        {
            var tables = await _context.Tables
                .Include(t => t.Zone)
                .Where(t => t.ZoneId == zoneId)
                .Select(t => new
                {
                    t.Id,
                    t.TableNumber,
                    t.Capacity,
                    ZoneName = t.Zone.Name,
                    Status = t.Status.ToString(),
                    t.QRCode
                })
                .ToListAsync();

            return Ok(tables);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tables for zone {ZoneId}", zoneId);
            return StatusCode(500, new { error = "Error al obtener mesas" });
        }
    }
}

/// <summary>
/// DTO para actualizar estado de mesa
/// </summary>
public class UpdateTableStatusDto
{
    public string NewStatus { get; set; } = string.Empty;
}

public class CreateTableDto
{
    public int TableNumber { get; set; }
    public int Capacity { get; set; }
    public int ZoneId { get; set; }
    public string? Name { get; set; }
    public string? Color { get; set; }
    public string? Shape { get; set; }
}

public class UpdateTableDto
{
    public int? TableNumber { get; set; }
    public int? Capacity { get; set; }
    public int? ZoneId { get; set; }
    public string? Name { get; set; }
    public string? Color { get; set; }
    public string? Shape { get; set; }
}
