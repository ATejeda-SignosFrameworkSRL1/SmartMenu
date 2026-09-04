using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Entities;
using SmartMenu.Application.Services;
using SmartMenu.Application.Common;
using System.Security.Claims;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TableTransferController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TableTransferController> _logger;
    private readonly ITableRealtimeNotifier _tableNotifier;

    public TableTransferController(ApplicationDbContext context, ILogger<TableTransferController> logger, ITableRealtimeNotifier tableNotifier)
    {
        _context = context;
        _logger = logger;
        _tableNotifier = tableNotifier;
    }

    private int CurrentUserId()
    {
        int.TryParse(User.FindFirst("sub")?.Value ?? User.FindFirstValue(ClaimTypes.NameIdentifier), out var id);
        return id;
    }
    private bool IsManagerOrAdmin() => User.IsInRole("Admin") || User.IsInRole("Manager");

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> Create([FromBody] CreateTransferDto dto)
    {
        if (dto.TableIds == null || dto.TableIds.Count == 0)
            return BadRequest(new { error = "Debe incluir al menos una mesa" });

        if (!IsManagerOrAdmin()) dto.FromWaiterId = CurrentUserId();

        var fromUser = await _context.Users.FindAsync(dto.FromWaiterId);
        var toUser = await _context.Users.FindAsync(dto.ToWaiterId);
        if (fromUser == null || toUser == null)
            return BadRequest(new { error = "Mesero no encontrado" });
        if (fromUser.Role != Domain.Enums.UserRole.Waiter || toUser.Role != Domain.Enums.UserRole.Waiter)
            return BadRequest(new { error = "Ambos deben ser meseros" });
        if (dto.FromWaiterId == dto.ToWaiterId)
            return BadRequest(new { error = "No puede transferir a sí mismo" });

        var req = new TableTransferRequest
        {
            FromWaiterId = dto.FromWaiterId,
            ToWaiterId = dto.ToWaiterId,
            TableIdsJson = JsonSerializer.Serialize(dto.TableIds),
            Status = TransferStatus.Pending
        };
        _context.TableTransferRequests.Add(req);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = req.Id }, new
        {
            req.Id,
            req.FromWaiterId,
            req.ToWaiterId,
            TableIds = dto.TableIds,
            Status = req.Status.ToString()
        });
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> Get(int id)
    {
        var req = await _context.TableTransferRequests
            .Include(r => r.FromWaiter)
            .Include(r => r.ToWaiter)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (req == null)
            return NotFound(new { message = "Solicitud no encontrada" });

        var tableIds = JsonSerializer.Deserialize<List<int>>(req.TableIdsJson ?? "[]") ?? new List<int>();
        return Ok(new
        {
            req.Id,
            FromWaiterId = req.FromWaiterId,
            FromWaiterName = $"{req.FromWaiter?.FirstName} {req.FromWaiter?.LastName}",
            ToWaiterId = req.ToWaiterId,
            ToWaiterName = $"{req.ToWaiter?.FirstName} {req.ToWaiter?.LastName}",
            TableIds = tableIds,
            Status = req.Status.ToString(),
            req.CreatedAt,
            req.RespondedAt
        });
    }

    [HttpGet("pending-for/{waiterId}")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> PendingFor(int waiterId)
    {
        var list = await _context.TableTransferRequests
            .Include(r => r.FromWaiter)
            .Where(r => r.ToWaiterId == waiterId && r.Status == TransferStatus.Pending)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.FromWaiterId,
                FromWaiterName = r.FromWaiter != null ? r.FromWaiter.FirstName + " " + r.FromWaiter.LastName : "",
                r.ToWaiterId,
                r.TableIdsJson,
                r.CreatedAt
            })
            .ToListAsync();

        var result = list.Select(r => new
        {
            r.Id,
            r.FromWaiterId,
            r.FromWaiterName,
            r.ToWaiterId,
            TableIds = string.IsNullOrEmpty(r.TableIdsJson) ? new List<int>() : JsonSerializer.Deserialize<List<int>>(r.TableIdsJson),
            r.CreatedAt
        }).ToList();

        return Ok(result);
    }

    [HttpPut("{id}/accept")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> Accept(int id, [FromQuery] int waiterId)
    {
        var req = await _context.TableTransferRequests.FindAsync(id);
        if (req == null)
            return NotFound(new { message = "Solicitud no encontrada" });
        if (req.Status != TransferStatus.Pending)
            return BadRequest(new { error = "La solicitud ya fue respondida" });
        if (req.ToWaiterId != waiterId)
            return BadRequest(new { error = "Solo el mesero destino puede aceptar" });

        var tableIds = JsonSerializer.Deserialize<List<int>>(req.TableIdsJson ?? "[]") ?? new List<int>();
        var ordersToUpdate = await _context.Orders
            .Where(o => o.TableId.HasValue && tableIds.Contains(o.TableId.Value) && o.AssignedWaiterId == req.FromWaiterId
                && o.Status != Domain.Enums.OrderStatus.Completed && o.Status != Domain.Enums.OrderStatus.Cancelled)
            .ToListAsync();
        foreach (var order in ordersToUpdate)
            order.AssignedWaiterId = req.ToWaiterId;

        req.Status = TransferStatus.Accepted;
        req.RespondedByWaiterId = waiterId;
        req.RespondedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        try
        {
            var toWaiter = await _context.Users.AsNoTracking()
                .Where(u => u.Id == req.ToWaiterId)
                .Select(u => new { u.FirstName, u.LastName })
                .FirstOrDefaultAsync();
            var initials = NameFormatting.Initials(toWaiter?.FirstName, toWaiter?.LastName);
            var fullName = NameFormatting.FullName(toWaiter?.FirstName, toWaiter?.LastName);
            foreach (var tid in ordersToUpdate.Where(o => o.TableId.HasValue).Select(o => o.TableId!.Value).Distinct())
                await _tableNotifier.TableWaiterChangedAsync(tid, initials, fullName);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "No se pudo difundir el cambio de mesero tras transferencia {Id}", id); }

        return Ok(new { message = "Transferencia aceptada", ordersUpdated = ordersToUpdate.Count });
    }

    [HttpPut("{id}/reject")]
    [Authorize(Roles = "Admin,Manager,Waiter")]
    public async Task<IActionResult> Reject(int id, [FromQuery] int waiterId)
    {
        var req = await _context.TableTransferRequests.FindAsync(id);
        if (req == null)
            return NotFound(new { message = "Solicitud no encontrada" });
        if (req.Status != TransferStatus.Pending)
            return BadRequest(new { error = "La solicitud ya fue respondida" });
        if (req.ToWaiterId != waiterId)
            return BadRequest(new { error = "Solo el mesero destino puede rechazar" });

        req.Status = TransferStatus.Rejected;
        req.RespondedByWaiterId = waiterId;
        req.RespondedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Transferencia rechazada" });
    }
}

public class CreateTransferDto
{
    public int FromWaiterId { get; set; }
    public int ToWaiterId { get; set; }
    public List<int> TableIds { get; set; } = new();
}
