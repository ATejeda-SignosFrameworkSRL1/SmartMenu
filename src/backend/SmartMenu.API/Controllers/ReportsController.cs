using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Enums;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(ApplicationDbContext context, ILogger<ReportsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Reporte de meseros: ventas, propinas, transacciones por mesero en un rango de fechas.
    /// </summary>
    [HttpGet("waiters")]
    public async Task<IActionResult> GetWaiterReport([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var fromDate = (from ?? DateTime.UtcNow.Date).Date;
        var toDate = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var waiters = await _context.Users
            .Where(u => u.Role == UserRole.Waiter && u.IsActive)
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
            .ToListAsync();

        var paymentsByWaiter = await _context.Payments
            .Where(p => p.ProcessedByWaiterId != null
                && p.CompletedAt >= fromDate
                && p.CompletedAt < toDate
                && p.Status == PaymentStatus.Completed)
            .GroupBy(p => p.ProcessedByWaiterId!.Value)
            .Select(g => new
            {
                WaiterId = g.Key,
                TotalSales = g.Sum(p => p.Amount),
                TotalTips = g.Sum(p => p.TipAmount),
                TransactionCount = g.Count()
            })
            .ToListAsync();

        var list = waiters.Select(w => new
        {
            w.Id,
            w.FirstName,
            w.LastName,
            w.Email,
            TotalSales = paymentsByWaiter.FirstOrDefault(p => p.WaiterId == w.Id)?.TotalSales ?? 0,
            TotalTips = paymentsByWaiter.FirstOrDefault(p => p.WaiterId == w.Id)?.TotalTips ?? 0,
            TransactionCount = paymentsByWaiter.FirstOrDefault(p => p.WaiterId == w.Id)?.TransactionCount ?? 0
        }).OrderByDescending(x => x.TotalSales).ToList();

        return Ok(new { From = fromDate, To = toDate.AddDays(-1), Waiters = list });
    }

    /// <summary>
    /// Tiempo promedio de preparación por plato (desde creación de la orden hasta servida).
    /// </summary>
    [HttpGet("dish-avg-time")]
    public async Task<IActionResult> GetDishAvgTime([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var fromDate = (from ?? DateTime.UtcNow.AddDays(-30)).Date;
        var toDate = (to ?? DateTime.UtcNow).Date.AddDays(1);

        var data = await _context.OrderItems
            .Include(oi => oi.Dish)
            .Include(oi => oi.Order)
            .Where(oi => oi.Order.CreatedAt >= fromDate
                      && oi.Order.CreatedAt < toDate
                      && oi.Order.ServedAt != null)
            .GroupBy(oi => new { oi.DishId, oi.Dish.Name, oi.Dish.PreparationTimeMinutes })
            .Select(g => new
            {
                dishId = g.Key.DishId,
                dishName = g.Key.Name,
                estimatedMinutes = g.Key.PreparationTimeMinutes,
                orderCount = g.Count(),
                avgMinutes = g.Average(oi =>
                    EF.Functions.DateDiffMinute(oi.Order.CreatedAt, oi.Order.ServedAt!.Value))
            })
            .OrderByDescending(x => x.avgMinutes)
            .ToListAsync();

        return Ok(data);
    }

    /// <summary>
    /// Detalle de mesero: % que le toca de los 10% de propina legal y total de propina para pagarle.
    /// </summary>
    [HttpGet("waiter-detail/{waiterId}")]
    public async Task<IActionResult> GetWaiterDetail(int waiterId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var fromDate = (from ?? DateTime.UtcNow.Date).Date;
        var toDate = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var waiter = await _context.Users.FindAsync(waiterId);
        if (waiter == null)
            return NotFound(new { message = "Mesero no encontrado" });

        var payments = await _context.Payments
            .Where(p => p.ProcessedByWaiterId == waiterId
                && p.CompletedAt >= fromDate
                && p.CompletedAt < toDate
                && p.Status == PaymentStatus.Completed)
            .ToListAsync();

        var totalSales = payments.Sum(p => p.Amount);
        var totalTipsLeftByCustomer = payments.Sum(p => p.TipAmount);
        const decimal legalTipPercent = 10m;
        var legalTipTotal = totalSales * (legalTipPercent / 100m);
        var waiterShareOfLegal = totalTipsLeftByCustomer;
        var waiterSharePercentOfLegal = totalSales > 0 && legalTipTotal > 0
            ? Math.Round((waiterShareOfLegal / legalTipTotal) * 100, 2)
            : 0m;

        return Ok(new
        {
            WaiterId = waiter.Id,
            WaiterName = $"{waiter.FirstName} {waiter.LastName}",
            From = fromDate,
            To = toDate.AddDays(-1),
            TotalSales = totalSales,
            LegalTipPercent = legalTipPercent,
            LegalTipTotal = legalTipTotal,
            TotalTipsFromCustomers = totalTipsLeftByCustomer,
            WaiterShareOfLegalPercent = waiterSharePercentOfLegal,
            TotalTipToPayToWaiter = totalTipsLeftByCustomer,
            TransactionCount = payments.Count
        });
    }
}
