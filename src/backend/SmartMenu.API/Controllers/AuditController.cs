using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class AuditController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AuditController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent(
        [FromQuery] int? userId = null,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] string? authMethod = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 200) pageSize = 50;

        var q = _context.AuditEvents
            .Include(e => e.User)
            .AsNoTracking()
            .AsQueryable();

        if (userId.HasValue)            q = q.Where(e => e.UserId == userId);
        if (!string.IsNullOrEmpty(action))       q = q.Where(e => e.Action == action);
        if (!string.IsNullOrEmpty(entityType))   q = q.Where(e => e.EntityType == entityType);
        if (!string.IsNullOrEmpty(authMethod))   q = q.Where(e => e.AuthMethod == authMethod);
        if (fromUtc.HasValue) q = q.Where(e => e.OccurredAt >= fromUtc);
        if (toUtc.HasValue)   q = q.Where(e => e.OccurredAt <= toUtc);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(e => e.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                id = e.Id,
                userId = e.UserId,
                userName = e.User != null ? (e.User.FirstName + " " + e.User.LastName) : null,
                action = e.Action,
                entityType = e.EntityType,
                entityId = e.EntityId,
                ipAddress = e.IpAddress,
                authMethod = e.AuthMethod,
                metadata = e.Metadata,
                occurredAt = e.OccurredAt
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            total,
            totalPages = (int)Math.Ceiling(total / (double)pageSize),
            items
        });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null)
    {
        var from = fromUtc ?? DateTime.UtcNow.Date;
        var to = toUtc ?? DateTime.UtcNow;

        var byUser = await _context.AuditEvents
            .Include(e => e.User)
            .Where(e => e.OccurredAt >= from && e.OccurredAt <= to)
            .GroupBy(e => new { e.UserId, UserName = (e.User != null ? e.User.FirstName + " " + e.User.LastName : "(unknown)") })
            .Select(g => new
            {
                userId = g.Key.UserId,
                userName = g.Key.UserName,
                eventsCount = g.Count(),
                pinAuthCount = g.Count(e => e.AuthMethod == "pin"),
                passwordAuthCount = g.Count(e => e.AuthMethod == "password"),
            })
            .OrderByDescending(s => s.eventsCount)
            .ToListAsync();

        var byAction = await _context.AuditEvents
            .Where(e => e.OccurredAt >= from && e.OccurredAt <= to)
            .GroupBy(e => e.Action)
            .Select(g => new { action = g.Key, count = g.Count() })
            .OrderByDescending(s => s.count)
            .ToListAsync();

        return Ok(new
        {
            from,
            to,
            totalEvents = byUser.Sum(u => u.eventsCount),
            byUser,
            byAction
        });
    }
}
