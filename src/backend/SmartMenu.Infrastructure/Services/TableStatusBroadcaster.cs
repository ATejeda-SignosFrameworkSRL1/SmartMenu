using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartMenu.Application.Common;
using SmartMenu.Application.Services;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Services;

/// <summary>
/// Implementación del punto único de difusión de estado de mesa. Lee el estado base de la(s)
/// mesa(s) + sus reservas activas, calcula el estado EFECTIVO con <see cref="TableStatusEvaluator"/>
/// y emite TableStatusChanged (PascalCase, igual que la API de mesas). Aditivo: ante cualquier
/// fallo solo se loguea, nunca se propaga (no debe romper la operación que lo invocó).
/// </summary>
public class TableStatusBroadcaster : ITableStatusBroadcaster
{
    private readonly ApplicationDbContext _context;
    private readonly ITableRealtimeNotifier _notifier;
    private readonly ILogger<TableStatusBroadcaster> _logger;

    public TableStatusBroadcaster(
        ApplicationDbContext context,
        ITableRealtimeNotifier notifier,
        ILogger<TableStatusBroadcaster> logger)
    {
        _context = context;
        _notifier = notifier;
        _logger = logger;
    }

    public Task BroadcastAsync(int tableId, CancellationToken ct = default)
        => BroadcastAsync(new[] { tableId }, ct);

    public async Task BroadcastAsync(IEnumerable<int> tableIds, CancellationToken ct = default)
    {
        var ids = tableIds.Where(id => id > 0).Distinct().ToList();
        if (ids.Count == 0) return;
        try
        {
            var nowLocal = RestaurantClock.Now;
            var tables = await _context.Tables.AsNoTracking()
                .Where(t => ids.Contains(t.Id))
                .Select(t => new { t.Id, t.Status })
                .ToListAsync(ct);
            var active = await _context.TableReservations.AsNoTracking()
                .Where(r => r.TableId != null && ids.Contains(r.TableId.Value)
                         && ReservationMath.ActiveStatuses.Contains(r.Status)
                         && nowLocal < r.EndDateTime)
                .ToListAsync(ct);
            foreach (var t in tables)
            {
                var blocking = active.Any(r => r.TableId == t.Id && TableStatusEvaluator.IsBlockingNow(r, nowLocal));
                var effective = TableStatusEvaluator.EffectiveStatus(t.Status, blocking);
                await _notifier.TableStatusChangedAsync(t.Id, effective.ToString());
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo difundir el estado de las mesas {TableIds}", string.Join(",", ids));
        }
    }
}
