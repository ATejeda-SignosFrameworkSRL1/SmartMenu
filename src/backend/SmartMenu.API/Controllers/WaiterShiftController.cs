using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WaiterShiftController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WaiterShiftController> _logger;

    public WaiterShiftController(ApplicationDbContext context, ILogger<WaiterShiftController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetShiftOwnerId(int? dtoWaiterId)
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var isPrivileged = role == "Admin" || role == "Manager";
        if (isPrivileged && dtoWaiterId.HasValue && dtoWaiterId.Value > 0)
            return dtoWaiterId.Value;
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(sub, out var id) ? id : null;
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartShift([FromBody] StartShiftDto dto)
    {
        var waiterId = GetShiftOwnerId(dto.WaiterId);
        if (waiterId == null) return Unauthorized(new { error = "Usuario no identificado" });

        var existing = await _context.WaiterShifts
            .FirstOrDefaultAsync(s => s.WaiterId == waiterId.Value && s.IsActive);
        if (existing != null)
            return BadRequest(new { error = "Ya tienes un turno activo" });

        var shift = new WaiterShift
        {
            WaiterId = waiterId.Value,
            StartTime = DateTime.UtcNow,
            IsActive = true,
            Notes = dto.Notes
        };
        _context.WaiterShifts.Add(shift);
        await _context.SaveChangesAsync();

        return Ok(new { id = shift.Id, startTime = shift.StartTime, message = "Turno iniciado" });
    }

    [HttpPut("{id}/end")]
    public async Task<IActionResult> EndShift(int id, [FromBody] EndShiftDto? dto = null)
    {
        var shift = await _context.WaiterShifts.FirstOrDefaultAsync(s => s.Id == id && s.IsActive);
        if (shift == null)
            return NotFound(new { error = "Turno no encontrado o ya cerrado" });

        var completedDuringShift = await _context.Orders
            .Where(o => o.AssignedWaiterId == shift.WaiterId
                && o.Status == SmartMenu.Domain.Enums.OrderStatus.Completed
                && o.CompletedAt >= shift.StartTime)
            .ToListAsync();

        var totalSales = completedDuringShift.Sum(o => o.Total);
        var totalTips = completedDuringShift.Sum(o => o.Tip);
        var completedOrders = completedDuringShift.Count;

        int transferredCount = 0;
        string? receiverName = null;
        if (dto?.UnassignOrders == true)
        {
            var activeOrders = await _context.Orders
                .Where(o => o.AssignedWaiterId == shift.WaiterId
                    && o.Status != SmartMenu.Domain.Enums.OrderStatus.Completed
                    && o.Status != SmartMenu.Domain.Enums.OrderStatus.Cancelled)
                .ToListAsync();
            transferredCount = activeOrders.Count;

            if (dto.TransferToWaiterId.HasValue)
            {
                var receiver = await _context.Users.FindAsync(dto.TransferToWaiterId.Value);
                receiverName = receiver != null ? $"{receiver.FirstName} {receiver.LastName}" : null;
                foreach (var order in activeOrders)
                    order.AssignedWaiterId = dto.TransferToWaiterId.Value;
                _logger.LogInformation("Transferred {Count} orders from waiter {From} to {To}", activeOrders.Count, shift.WaiterId, dto.TransferToWaiterId.Value);
            }
            else
            {
                foreach (var order in activeOrders)
                    order.AssignedWaiterId = null;
                _logger.LogInformation("Unassigned {Count} orders from waiter {WaiterId}", activeOrders.Count, shift.WaiterId);
            }
        }

        shift.IsActive = false;
        shift.EndTime = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var duration = shift.EndTime.Value - shift.StartTime;
        return Ok(new
        {
            message = "Turno cerrado",
            shiftId = shift.Id,
            durationMinutes = Math.Round(duration.TotalMinutes, 0),
            durationFormatted = $"{(int)duration.TotalHours}h {duration.Minutes}m",
            totalSales,
            totalTips,
            completedOrders,
            transferredTables = transferredCount,
            transferredTo = receiverName
        });
    }

    [HttpGet("active/{waiterId}")]
    public async Task<IActionResult> GetActiveShift(int waiterId)
    {
        var shift = await _context.WaiterShifts
            .FirstOrDefaultAsync(s => s.WaiterId == waiterId && s.IsActive);

        if (shift == null)
            return Ok(new { hasActiveShift = false });

        return Ok(new
        {
            hasActiveShift = true,
            id = shift.Id,
            startTime = shift.StartTime,
            durationMinutes = Math.Round((DateTime.UtcNow - shift.StartTime).TotalMinutes, 0)
        });
    }

    [HttpGet("summary/{waiterId}")]
    public async Task<IActionResult> GetShiftSummary(int waiterId)
    {
        var shift = await _context.WaiterShifts
            .FirstOrDefaultAsync(s => s.WaiterId == waiterId && s.IsActive);

        if (shift == null)
            return Ok(new { hasActiveShift = false });

        var activeOrders = await _context.Orders
            .Include(o => o.Table).ThenInclude(t => t.Zone)
            .Include(o => o.Items).ThenInclude(i => i.Dish)
            .Include(o => o.Payments)
            .Where(o => o.AssignedWaiterId == waiterId
                && o.Status != SmartMenu.Domain.Enums.OrderStatus.Completed
                && o.Status != SmartMenu.Domain.Enums.OrderStatus.Cancelled)
            .ToListAsync();

        var completedDuringShift = await _context.Orders
            .Include(o => o.Payments)
            .Where(o => o.AssignedWaiterId == waiterId
                && o.Status == SmartMenu.Domain.Enums.OrderStatus.Completed
                && o.CompletedAt >= shift.StartTime)
            .ToListAsync();

        var shiftTotalSales = completedDuringShift.Sum(o => o.Total);
        var shiftTotalTips = completedDuringShift.Sum(o => o.Tip);

        var activeTables = activeOrders.Select(o => new
        {
            orderId = o.Id,
            orderNumber = o.OrderNumber,
            tableId = o.TableId,
            tableNumber = o.Table?.TableNumber ?? 0,
            zoneName = o.Table?.Zone?.Name ?? "",
            status = o.Status.ToString(),
            customerName = o.CustomerName ?? "",
            subtotal = o.Subtotal,
            tip = o.Tip,
            total = o.Total,
            hasPendingPayment = !o.Payments.Any(p => p.Status == SmartMenu.Domain.Enums.PaymentStatus.Completed),
            itemCount = o.Items.Count,
            items = o.Items.Select(i => new
            {
                dishName = i.Dish?.Name ?? "",
                quantity = i.Quantity
            }).ToList()
        }).ToList();

        var duration = DateTime.UtcNow - shift.StartTime;

        return Ok(new
        {
            hasActiveShift = true,
            shiftId = shift.Id,
            startTime = shift.StartTime,
            durationMinutes = Math.Round(duration.TotalMinutes, 0),
            activeTables,
            activeTableCount = activeTables.Count,
            pendingBillingCount = activeTables.Count(t => t.hasPendingPayment),
            shiftTotalSales,
            shiftTotalTips
        });
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetAllActiveShifts()
    {
        var shifts = await _context.WaiterShifts
            .Include(s => s.Waiter)
            .Where(s => s.IsActive)
            .Select(s => new
            {
                id = s.Id,
                waiterId = s.WaiterId,
                waiterName = s.Waiter.FirstName + " " + s.Waiter.LastName,
                startTime = s.StartTime,
                durationMinutes = Math.Round((DateTime.UtcNow - s.StartTime).TotalMinutes, 0)
            })
            .ToListAsync();

        return Ok(shifts);
    }
}

public class StartShiftDto
{
    public int WaiterId { get; set; }
    public string? Notes { get; set; }
}

public class EndShiftDto
{
    public bool UnassignOrders { get; set; } = true;
    public int? TransferToWaiterId { get; set; }
}
