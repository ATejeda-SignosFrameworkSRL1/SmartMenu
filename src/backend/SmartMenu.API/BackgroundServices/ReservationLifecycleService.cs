using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartMenu.API.Hubs;
using SmartMenu.Application.Common;
using SmartMenu.Application.Services;
using SmartMenu.Application.Settings;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.BackgroundServices;

/// <summary>
/// Barrido periódico del ciclo de vida de reservas (capacidad dinámica por intervalo):
///   1) expira holds Pending vencidos → Expired (libera pool),
///   2) marca no-show automático tras el período de gracia → NoShow (libera pool, notifica),
///   3) envía recordatorios (stub) antes de la reserva,
///   4) auto-completa reservas Seated cuya TableSession ya cerró → Completed.
/// Cada tick usa su propio scope DI. Comparaciones en hora local del restaurante.
/// </summary>
public class ReservationLifecycleService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<ReservationHub> _hub;
    private readonly ReservationSettings _settings;
    private readonly ILogger<ReservationLifecycleService> _logger;

    public ReservationLifecycleService(
        IServiceScopeFactory scopeFactory,
        IHubContext<ReservationHub> hub,
        IOptions<ReservationSettings> settings,
        ILogger<ReservationLifecycleService> logger)
    {
        _scopeFactory = scopeFactory;
        _hub = hub;
        _settings = settings.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(Math.Max(15, _settings.SweepIntervalSeconds));
        // Pequeño retraso inicial para no competir con migraciones/seed al arrancar.
        try { await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken); } catch { }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { _logger.LogWarning(ex, "Barrido de reservas falló (no fatal)"); }
            try { await Task.Delay(interval, stoppingToken); } catch { }
        }
    }

    /// <summary>Una pasada completa. Pública para poder invocarla desde tests sin esperar el timer.</summary>
    public async Task SweepAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var notify = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var now = RestaurantClock.Now;

        await ExpireHoldsAsync(db, now, ct);
        await AutoNoShowAsync(db, notify, now, ct);
        await RemindersAsync(db, notify, now, ct);
        await AutoCompleteAsync(db, ct);
    }

    private async Task ExpireHoldsAsync(ApplicationDbContext db, DateTime now, CancellationToken ct)
    {
        var holds = await db.TableReservations
            .Where(r => r.Status == ReservationStatus.Pending && r.HoldExpiresAt != null && r.HoldExpiresAt < now)
            .ToListAsync(ct);
        if (holds.Count == 0) return;
        foreach (var r in holds)
        {
            r.Status = ReservationStatus.Expired;
            r.HoldExpiresAt = null;
            ReservationMath.SyncLegacyFlags(r);
        }
        await db.SaveChangesAsync(ct);
        _logger.LogInformation("Holds expirados: {N}", holds.Count);
    }

    private async Task AutoNoShowAsync(ApplicationDbContext db, INotificationService notify, DateTime now, CancellationToken ct)
    {
        var cutoff = now.AddMinutes(-_settings.NoShowGraceMinutes);
        var due = await db.TableReservations
            .Where(r => r.Status == ReservationStatus.Confirmed && r.TableSessionId == null && r.ReservationDateTime < cutoff)
            .ToListAsync(ct);
        if (due.Count == 0) return;
        foreach (var r in due)
        {
            r.Status = ReservationStatus.NoShow;
            r.NoShowAt = now;
            ReservationMath.SyncLegacyFlags(r);
        }
        await db.SaveChangesAsync(ct);
        foreach (var r in due)
        {
            try { await notify.SendNoShowAsync(r.Id, ct); } catch { /* stub */ }
            await _hub.Clients.All.SendAsync("ReservationNoShow", new { reservationId = r.Id, timestamp = DateTime.UtcNow }, ct);
        }
        await _hub.Clients.All.SendAsync("AvailabilityChanged", new { date = (string?)null, timestamp = DateTime.UtcNow }, ct);
        _logger.LogInformation("No-shows automáticos: {N}", due.Count);
    }

    private async Task RemindersAsync(ApplicationDbContext db, INotificationService notify, DateTime now, CancellationToken ct)
    {
        if (_settings.ReminderOffsetsMinutes is not { Length: > 0 }) return;
        int minOffset = _settings.ReminderOffsetsMinutes.Min();
        var windowEnd = now.AddMinutes(minOffset);
        var due = await db.TableReservations
            .Where(r => r.Status == ReservationStatus.Confirmed && r.ReminderSentAt == null
                     && r.ReservationDateTime > now && r.ReservationDateTime <= windowEnd)
            .ToListAsync(ct);
        if (due.Count == 0) return;
        foreach (var r in due) r.ReminderSentAt = now;
        await db.SaveChangesAsync(ct);
        foreach (var r in due) { try { await notify.SendReminderAsync(r.Id, ct); } catch { /* stub */ } }
        _logger.LogInformation("Recordatorios enviados: {N}", due.Count);
    }

    private async Task AutoCompleteAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var seated = await db.TableReservations
            .Where(r => r.Status == ReservationStatus.Seated && r.TableSessionId != null)
            .ToListAsync(ct);
        if (seated.Count == 0) return;

        var sessionIds = seated.Select(r => r.TableSessionId!.Value).ToList();
        var closed = await db.TableSessions
            .Where(s => sessionIds.Contains(s.Id) && !s.IsActive)
            .Select(s => s.Id)
            .ToListAsync(ct);
        if (closed.Count == 0) return;

        var toComplete = seated.Where(r => closed.Contains(r.TableSessionId!.Value)).ToList();
        foreach (var r in toComplete)
        {
            r.Status = ReservationStatus.Completed;
            r.CompletedAt = RestaurantClock.Now;
            ReservationMath.SyncLegacyFlags(r);
        }
        await db.SaveChangesAsync(ct);
        foreach (var r in toComplete)
            await _hub.Clients.All.SendAsync("ReservationCompleted", new { reservationId = r.Id, timestamp = DateTime.UtcNow }, ct);
        _logger.LogInformation("Reservas auto-completadas: {N}", toComplete.Count);
    }
}
