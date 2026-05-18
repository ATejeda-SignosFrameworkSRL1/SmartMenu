using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TableSessionController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TableSessionController> _logger;

    public TableSessionController(ApplicationDbContext context, ILogger<TableSessionController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveSessions()
    {
        try
        {
            var sessions = await _context.TableSessions
                .Where(ts => ts.IsActive)
                .Include(ts => ts.Table)
                .ThenInclude(t => t.Zone)
                .Include(ts => ts.AssignedWaiter)
                .Select(ts => new
                {
                    ts.Id,
                    ts.TableId,
                    TableNumber = ts.Table.TableNumber,
                    ZoneName = ts.Table.Zone.Name,
                    ts.NumberOfGuests,
                    ts.StartTime,
                    WaiterName = ts.AssignedWaiter != null ? ts.AssignedWaiter.FirstName + " " + ts.AssignedWaiter.LastName : null,
                    DurationMinutes = (int)(DateTime.UtcNow - ts.StartTime).TotalMinutes
                })
                .ToListAsync();

            return Ok(sessions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting active sessions");
            return StatusCode(500, new { error = "Error al obtener sesiones activas" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateSession([FromBody] CreateSessionDto dto)
    {
        try
        {
            var table = await _context.Tables.FindAsync(dto.TableId);
            if (table == null)
                return NotFound(new { error = "Mesa no encontrada" });

            // Verificar que la mesa esté disponible
            if (table.Status != TableStatus.Available && table.Status != TableStatus.Reserved)
                return BadRequest(new { error = "La mesa no está disponible" });

            // Si está reservada: no usar hasta que pase ReservedUntil (evitar roces con el cliente de la reserva)
            if (table.Status == TableStatus.Reserved)
            {
                var activeReservation = await _context.TableReservations
                    .Where(r => r.TableId == dto.TableId && !r.IsCancelled && r.ReservedUntil.HasValue && r.ReservedUntil.Value > DateTime.UtcNow)
                    .OrderByDescending(r => r.ReservedUntil)
                    .FirstOrDefaultAsync();
                if (activeReservation != null)
                    return BadRequest(new { error = "La mesa está reservada hasta " + activeReservation.ReservedUntil!.Value.ToLocalTime().ToString("HH:mm") + ". No se puede asignar." });
                // Reserva vencida: permitir asignar y la mesa pasará a Occupied
            }

            var session = new TableSession
            {
                TableId = dto.TableId,
                NumberOfGuests = dto.NumberOfGuests,
                AssignedByHostId = dto.HostId,
                SpecialNotes = dto.SpecialNotes,
                StartTime = DateTime.UtcNow,
                IsActive = true
            };

            _context.TableSessions.Add(session);

            // Actualizar estado de la mesa
            table.Status = TableStatus.Occupied;

            await _context.SaveChangesAsync();

            return Ok(new { id = session.Id, message = "Sesión creada exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating session");
            return StatusCode(500, new { error = "Error al crear sesión" });
        }
    }

    [HttpPut("{id}/close")]
    public async Task<IActionResult> CloseSession(int id)
    {
        try
        {
            var session = await _context.TableSessions
                .Include(ts => ts.Table)
                .FirstOrDefaultAsync(ts => ts.Id == id);

            if (session == null)
                return NotFound(new { error = "Sesión no encontrada" });

            session.IsActive = false;
            session.EndTime = DateTime.UtcNow;

            // Liberar la mesa
            session.Table.Status = TableStatus.Available;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Sesión cerrada exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error closing session {SessionId}", id);
            return StatusCode(500, new { error = "Error al cerrar sesión" });
        }
    }

    /// <summary>
    /// Mesero reclama una mesa: crea sesión y se asigna como mesero
    /// </summary>
    [HttpPost("claim")]
    public async Task<IActionResult> ClaimTable([FromBody] ClaimTableDto dto)
    {
        try
        {
            var table = await _context.Tables.FindAsync(dto.TableId);
            if (table == null)
                return NotFound(new { error = "Mesa no encontrada" });

            var waiter = await _context.Users.FindAsync(dto.WaiterId);
            if (waiter == null)
                return BadRequest(new { error = "Mesero no encontrado" });

            var existingSession = await _context.TableSessions
                .FirstOrDefaultAsync(ts => ts.TableId == dto.TableId && ts.IsActive);

            if (existingSession != null)
            {
                if (existingSession.AssignedWaiterId != null && existingSession.AssignedWaiterId != dto.WaiterId)
                    return BadRequest(new { error = "Esta mesa ya tiene un mesero asignado" });

                existingSession.AssignedWaiterId = dto.WaiterId;
                await _context.SaveChangesAsync();
                return Ok(new { id = existingSession.Id, message = "Mesa asignada a ti" });
            }

            var session = new TableSession
            {
                TableId = dto.TableId,
                NumberOfGuests = dto.NumberOfGuests ?? 0,
                AssignedWaiterId = dto.WaiterId,
                StartTime = DateTime.UtcNow,
                IsActive = true
            };

            _context.TableSessions.Add(session);

            if (table.Status == TableStatus.Available)
                table.Status = TableStatus.Occupied;

            await _context.SaveChangesAsync();

            return Ok(new { id = session.Id, message = "Mesa tomada exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error claiming table");
            return StatusCode(500, new { error = "Error al tomar mesa" });
        }
    }

    [HttpPut("{id}/assign-waiter")]
    public async Task<IActionResult> AssignWaiter(int id, [FromBody] AssignWaiterDto dto)
    {
        try
        {
            var session = await _context.TableSessions.FindAsync(id);
            if (session == null)
                return NotFound(new { error = "Sesión no encontrada" });

            session.AssignedWaiterId = dto.WaiterId;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Mesero asignado exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning waiter to session {SessionId}", id);
            return StatusCode(500, new { error = "Error al asignar mesero" });
        }
    }
}

public class CreateSessionDto
{
    public int TableId { get; set; }
    public int NumberOfGuests { get; set; }
    public int? HostId { get; set; }
    public string? SpecialNotes { get; set; }
}

public class AssignWaiterDto
{
    public int WaiterId { get; set; }
}

public class ClaimTableDto
{
    public int TableId { get; set; }
    public int WaiterId { get; set; }
    public int? NumberOfGuests { get; set; }
}
