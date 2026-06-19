using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.API.Hubs;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/tableclaim")]
[Authorize]
public class TableClaimController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<OrderHub> _hub;
    private readonly ILogger<TableClaimController> _logger;

    public TableClaimController(ApplicationDbContext context, IHubContext<OrderHub> hub, ILogger<TableClaimController> logger)
    {
        _context = context;
        _hub = hub;
        _logger = logger;
    }

    /// <summary>
    /// Extrae el userId del JWT (claim 'sub' o NameIdentifier).
    /// Devuelve null si no se puede parsear o es 0.
    /// </summary>
    private int? GetUserIdFromJwt()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value
                  ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(sub, out var id) && id > 0) return id;
        return null;
    }

    /// <summary>
    /// Mesero solicita quedarse con una mesa. El admin recibirá notificación por SignalR.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> RequestClaim([FromBody] RequestClaimDto dto)
    {
        try
        {
            var waiter = await _context.Users.FindAsync(dto.WaiterId);
            if (waiter == null)
                return NotFound(new { error = "Mesero no encontrado" });

            var table = await _context.Tables.FindAsync(dto.TableId);
            if (table == null)
                return NotFound(new { error = "Mesa no encontrada" });

            // Cancelar solicitudes pendientes anteriores del mismo mesero para la misma mesa
            var existing = await _context.TableClaimRequests
                .Where(r => r.WaiterId == dto.WaiterId && r.TableId == dto.TableId && r.Status == ClaimRequestStatus.Pending)
                .ToListAsync();
            foreach (var e in existing) e.Status = ClaimRequestStatus.Rejected;

            var request = new TableClaimRequest
            {
                WaiterId = dto.WaiterId,
                TableId = dto.TableId,
                OrderId = dto.OrderId,
                Status = ClaimRequestStatus.Pending,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _context.TableClaimRequests.Add(request);
            await _context.SaveChangesAsync();

            // Notificar al grupo "admin" en tiempo real
            await _hub.Clients.Group("admin").SendAsync("TableClaimRequested", new
            {
                requestId = request.Id,
                waiterId = waiter.Id,
                waiterName = $"{waiter.FirstName} {waiter.LastName}",
                tableId = table.Id,
                tableNumber = table.TableNumber,
                orderId = dto.OrderId,
                message = $"{waiter.FirstName} {waiter.LastName} quiere quedarse con la Mesa {table.TableNumber}",
                timestamp = DateTime.UtcNow
            });

            _logger.LogInformation("TableClaimRequest {RequestId} created by waiter {WaiterId} for table {TableId}", request.Id, dto.WaiterId, dto.TableId);
            return Ok(new { requestId = request.Id, message = "Solicitud enviada al administrador" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating table claim request");
            return StatusCode(500, new { error = "Error al enviar la solicitud" });
        }
    }

    /// <summary>
    /// Admin aprueba la solicitud. Se asigna el mesero a la sesión de mesa y se notifica al mesero.
    /// Solo Admin/Manager. El AdminId se extrae del JWT (no del body) para evitar spoofing.
    /// </summary>
    [HttpPut("{id}/approve")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Approve(int id, [FromBody] RespondClaimDto? dto)
    {
        try
        {
            // CLAIM-FIX.1 — extraer adminId del JWT, NO del body.
            // El body anterior aceptaba adminId=0 → FK constraint violation → 500.
            var adminId = GetUserIdFromJwt();
            if (adminId == null)
                return Unauthorized(new { error = "No se pudo identificar al admin desde el token" });

            var request = await _context.TableClaimRequests
                .Include(r => r.Waiter)
                .Include(r => r.Table)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound(new { error = "Solicitud no encontrada" });
            if (request.Status != ClaimRequestStatus.Pending)
                return BadRequest(new { error = "La solicitud ya fue respondida" });

            request.Status = ClaimRequestStatus.Approved;
            request.RespondedByAdminId = adminId.Value;
            request.RespondedAt = DateTime.UtcNow;
            request.AdminNote = dto?.Note;
            request.UpdatedAt = DateTime.UtcNow;

            // Asignar el mesero a la sesión activa de la mesa (o crearla si no existe)
            var session = await _context.TableSessions
                .FirstOrDefaultAsync(s => s.TableId == request.TableId && s.IsActive);

            if (session != null)
            {
                session.AssignedWaiterId = request.WaiterId;
                session.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Crear sesión nueva si la mesa no tiene una activa
                _context.TableSessions.Add(new TableSession
                {
                    TableId = request.TableId,
                    AssignedWaiterId = request.WaiterId,
                    NumberOfGuests = 1,
                    IsActive = true,
                    StartTime = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            }

            // Actualizar órdenes activas de esa mesa para asignarlas al mesero
            if (request.OrderId.HasValue)
            {
                var order = await _context.Orders.FindAsync(request.OrderId.Value);
                if (order != null && order.AssignedWaiterId == null)
                {
                    order.AssignedWaiterId = request.WaiterId;
                    order.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            // Notificar al mesero
            await _hub.Clients.Group($"waiter_{request.WaiterId}").SendAsync("TableClaimApproved", new
            {
                requestId = request.Id,
                tableId = request.TableId,
                tableNumber = request.Table.TableNumber,
                message = $"¡Solicitud aprobada! La Mesa {request.Table.TableNumber} es tuya.",
                adminNote = dto?.Note,
                timestamp = DateTime.UtcNow
            });

            _logger.LogInformation("TableClaimRequest {RequestId} approved by admin {AdminId} for waiter {WaiterId}", id, adminId, request.WaiterId);
            return Ok(new { message = $"Solicitud aprobada. Mesa {request.Table.TableNumber} asignada a {request.Waiter.FirstName}." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving table claim request {RequestId}", id);
            return StatusCode(500, new { error = "Error al aprobar la solicitud" });
        }
    }

    /// <summary>
    /// Admin rechaza la solicitud. El mesero recibe notificación de rechazo.
    /// Solo Admin/Manager. El AdminId se extrae del JWT (no del body).
    /// </summary>
    [HttpPut("{id}/reject")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Reject(int id, [FromBody] RespondClaimDto? dto)
    {
        try
        {
            var adminId = GetUserIdFromJwt();
            if (adminId == null)
                return Unauthorized(new { error = "No se pudo identificar al admin desde el token" });

            var request = await _context.TableClaimRequests
                .Include(r => r.Waiter)
                .Include(r => r.Table)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound(new { error = "Solicitud no encontrada" });
            if (request.Status != ClaimRequestStatus.Pending)
                return BadRequest(new { error = "La solicitud ya fue respondida" });

            request.Status = ClaimRequestStatus.Rejected;
            request.RespondedByAdminId = adminId.Value;
            request.RespondedAt = DateTime.UtcNow;
            request.AdminNote = dto?.Note;
            request.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Notificar al mesero
            await _hub.Clients.Group($"waiter_{request.WaiterId}").SendAsync("TableClaimRejected", new
            {
                requestId = request.Id,
                tableId = request.TableId,
                tableNumber = request.Table.TableNumber,
                message = $"El admin no aprobó tu solicitud para la Mesa {request.Table.TableNumber}.",
                adminNote = dto?.Note,
                timestamp = DateTime.UtcNow
            });

            _logger.LogInformation("TableClaimRequest {RequestId} rejected by admin {AdminId} for waiter {WaiterId}", id, adminId, request.WaiterId);
            return Ok(new { message = "Solicitud rechazada." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting table claim request {RequestId}", id);
            return StatusCode(500, new { error = "Error al rechazar la solicitud" });
        }
    }

    /// <summary>
    /// Admin lista todas las solicitudes pendientes.
    /// </summary>
    [HttpGet("pending")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> GetPending()
    {
        var requests = await _context.TableClaimRequests
            .Include(r => r.Waiter)
            .Include(r => r.Table)
            .Where(r => r.Status == ClaimRequestStatus.Pending)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.WaiterId,
                WaiterName = r.Waiter.FirstName + " " + r.Waiter.LastName,
                r.TableId,
                TableNumber = r.Table.TableNumber,
                r.OrderId,
                r.CreatedAt
            })
            .ToListAsync();

        return Ok(requests);
    }

    /// <summary>
    /// Historial de solicitudes (todas, para admin).
    /// </summary>
    [HttpGet("history")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> GetHistory([FromQuery] int? waiterId)
    {
        var q = _context.TableClaimRequests
            .Include(r => r.Waiter)
            .Include(r => r.Table)
            .AsQueryable();

        if (waiterId.HasValue) q = q.Where(r => r.WaiterId == waiterId.Value);

        var requests = await q
            .OrderByDescending(r => r.CreatedAt)
            .Take(100)
            .Select(r => new
            {
                r.Id,
                r.WaiterId,
                WaiterName = r.Waiter.FirstName + " " + r.Waiter.LastName,
                r.TableId,
                TableNumber = r.Table.TableNumber,
                r.OrderId,
                r.Status,
                r.AdminNote,
                r.RespondedAt,
                r.CreatedAt
            })
            .ToListAsync();

        return Ok(requests);
    }
}

public class RequestClaimDto
{
    public int WaiterId { get; set; }
    public int TableId { get; set; }
    public int? OrderId { get; set; }
}

public class RespondClaimDto
{
    public int AdminId { get; set; }
    public string? Note { get; set; }
}
