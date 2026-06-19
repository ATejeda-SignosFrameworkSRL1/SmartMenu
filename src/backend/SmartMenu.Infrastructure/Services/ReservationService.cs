using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartMenu.Application.Common;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.Application.Settings;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Services;

/// <summary>
/// Operaciones transaccionales de reservas (capacidad dinámica por intervalo).
/// La sección crítica de booking re-valida la disponibilidad DENTRO de un sp_getapplock
/// (keyed por restaurante:turno:slot) + transacción, de modo que el overbooking es imposible.
/// Las ediciones de host usan RowVersion (concurrencia optimista). Status es la fuente de verdad;
/// IsConfirmed/IsCancelled se sincronizan (dual-write) para compatibilidad con el código legacy.
/// </summary>
public class ReservationService : IReservationService
{
    private readonly ApplicationDbContext _context;
    private readonly IReservationAvailabilityService _availability;
    private readonly ReservationSettings _settings;
    private readonly INotificationService _notify;
    private readonly IDepositService _deposit;
    private readonly ILogger<ReservationService> _logger;
    private readonly ITableRealtimeNotifier _tableNotifier;

    public ReservationService(
        ApplicationDbContext context,
        IReservationAvailabilityService availability,
        IOptions<ReservationSettings> settings,
        INotificationService notify,
        IDepositService deposit,
        ILogger<ReservationService> logger,
        ITableRealtimeNotifier tableNotifier)
    {
        _context = context;
        _availability = availability;
        _settings = settings.Value;
        _notify = notify;
        _deposit = deposit;
        _logger = logger;
        _tableNotifier = tableNotifier;
    }

    // ─────────────────────────── Booking público (hold) ───────────────────────────

    public async Task<ReservationActionResult> CreateHoldAsync(HoldRequestDto dto, CancellationToken ct = default)
    {
        if (!DateOnly.TryParse(dto.Date, out var date) || !TimeOnly.TryParse(dto.Time, out var time))
            return ReservationActionResult.Fail("Fecha u hora inválida", "BAD_INPUT");
        if (dto.Guests < 1)
            return ReservationActionResult.Fail("Número de comensales inválido", "BAD_INPUT");

        var period = await ResolvePeriodAsync(date, time, ct);
        if (period == null)
            return ReservationActionResult.Fail("No hay servicio disponible en ese horario", "NO_SERVICE");

        var startLocal = date.ToDateTime(time);
        var now = RestaurantClock.Now;
        if (startLocal < now.AddMinutes(period.LeadTimeMinutes))
            return ReservationActionResult.Fail("Ese horario ya no está disponible", "TOO_LATE");

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        if (!await TryAcquireAppLockAsync(SlotLockKey(period, startLocal), ct))
        {
            await tx.RollbackAsync(ct);
            return ReservationActionResult.Fail("Demasiadas solicitudes, reintenta", "BUSY");
        }

        var feas = await _availability.CheckSlotAsync(period, startLocal, dto.Guests, dto.ZoneId, null, ct);
        if (!feas.Bookable)
        {
            await tx.RollbackAsync(ct);
            return ReservationActionResult.Fail("Ese horario acaba de llenarse", "SLOT_FULL");
        }

        int duration = ReservationMath.ResolveDuration(period, dto.Guests);
        var endLocal = startLocal.AddMinutes(duration + period.TurnoverBufferMinutes);
        var res = new TableReservation
        {
            Status = ReservationStatus.Pending,
            Source = "Portal",
            NumberOfGuests = dto.Guests,
            RequestedZoneId = dto.ZoneId,
            ReservationDateTime = startLocal,
            DurationMinutes = duration,
            EndDateTime = endLocal,
            ReservedUntil = endLocal,
            ServicePeriodId = period.Id,
            HoldExpiresAt = now.AddMinutes(_settings.HoldTtlMinutes),
            ConfirmationCode = GenerateCode(),
            DepositStatus = "None",
            CustomerName = string.Empty,
            CustomerPhone = string.Empty,
            IsConfirmed = false,
            IsCancelled = false,
        };
        _context.TableReservations.Add(res);
        await _context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ReservationActionResult
        {
            Success = true,
            ReservationId = res.Id,
            ConfirmationCode = res.ConfirmationCode,
            Status = res.Status.ToString(),
            HoldExpiresAt = res.HoldExpiresAt,
            ReservationDateTime = startLocal.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
    }

    public async Task<ReservationActionResult> ConfirmPublicAsync(int id, ConfirmPublicDto dto, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        if (string.IsNullOrWhiteSpace(dto.ConfirmationCode) || !string.Equals(dto.ConfirmationCode, res.ConfirmationCode, StringComparison.OrdinalIgnoreCase))
            return ReservationActionResult.Fail("Código de confirmación inválido", "BAD_CODE");
        if (res.Status == ReservationStatus.Expired || res.Status == ReservationStatus.Cancelled)
            return ReservationActionResult.Fail("El hold expiró, vuelve a elegir horario", "EXPIRED");
        if (res.Status != ReservationStatus.Pending && res.Status != ReservationStatus.Confirmed)
            return ReservationActionResult.Fail("La reserva no se puede confirmar en su estado actual", "BAD_STATE");

        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone))
            return ReservationActionResult.Fail("Nombre y teléfono son obligatorios", "BAD_INPUT");

        res.CustomerName = dto.CustomerName.Trim();
        res.CustomerPhone = dto.CustomerPhone.Trim();
        res.CustomerEmail = dto.CustomerEmail?.Trim();
        res.OccasionType = (OccasionType)dto.OccasionType;
        res.SpecialRequests = dto.SpecialRequests;
        res.Status = ReservationStatus.Confirmed;
        res.HoldExpiresAt = null;
        SyncLegacyFlags(res);
        await _context.SaveChangesAsync(ct);

        await SafeNotifyAsync(() => _notify.SendConfirmationAsync(res.Id, ct));
        if (_settings.RequireDeposit && res.DepositAmount is > 0)
            await _deposit.RequestDepositAsync(res.Id, res.DepositAmount.Value, ct);

        return new ReservationActionResult
        {
            Success = true,
            ReservationId = res.Id,
            ConfirmationCode = res.ConfirmationCode,
            Status = res.Status.ToString(),
            ReservationDateTime = res.ReservationDateTime.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
    }

    // ─────────────────────────── Creación staff ───────────────────────────

    public async Task<ReservationActionResult> CreateStaffAsync(CreateReservationStaffDto dto, CancellationToken ct = default)
    {
        DateTime startLocal;
        if (dto.ReservationDateTime.HasValue)
            startLocal = DateTime.SpecifyKind(dto.ReservationDateTime.Value, DateTimeKind.Unspecified);
        else if (DateOnly.TryParse(dto.Date, out var d) && TimeOnly.TryParse(dto.Time, out var tm))
            startLocal = d.ToDateTime(tm);
        else
            return ReservationActionResult.Fail("Fecha u hora inválida", "BAD_INPUT");

        if (dto.NumberOfGuests < 1)
            return ReservationActionResult.Fail("Número de comensales inválido", "BAD_INPUT");
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone))
            return ReservationActionResult.Fail("Nombre y teléfono son obligatorios", "BAD_INPUT");

        var date = DateOnly.FromDateTime(startLocal);
        var time = TimeOnly.FromDateTime(startLocal);
        var period = await ResolvePeriodAsync(date, time, ct);
        if (period == null)
            return ReservationActionResult.Fail("No hay servicio disponible en ese horario", "NO_SERVICE");

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        if (!await TryAcquireAppLockAsync(SlotLockKey(period, startLocal), ct))
        {
            await tx.RollbackAsync(ct);
            return ReservationActionResult.Fail("Demasiadas solicitudes, reintenta", "BUSY");
        }

        var feas = await _availability.CheckSlotAsync(period, startLocal, dto.NumberOfGuests, dto.ZoneId, null, ct);
        if (!feas.Bookable)
        {
            await tx.RollbackAsync(ct);
            return ReservationActionResult.Fail("Ese horario no tiene capacidad disponible", "SLOT_FULL");
        }

        int duration = ReservationMath.ResolveDuration(period, dto.NumberOfGuests);
        var endLocal = startLocal.AddMinutes(duration + period.TurnoverBufferMinutes);
        var res = new TableReservation
        {
            Status = ReservationStatus.Confirmed,
            Source = "Internal",
            NumberOfGuests = dto.NumberOfGuests,
            RequestedZoneId = dto.ZoneId,
            TableId = dto.TableId,
            ReservationDateTime = startLocal,
            DurationMinutes = duration,
            EndDateTime = endLocal,
            ReservedUntil = endLocal,
            ServicePeriodId = period.Id,
            ConfirmationCode = GenerateCode(),
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            CustomerEmail = dto.CustomerEmail?.Trim(),
            OccasionType = (OccasionType)dto.OccasionType,
            SpecialRequests = dto.SpecialRequests,
            CreatedByHostId = dto.HostId,
            DepositStatus = "None",
        };
        SyncLegacyFlags(res);
        _context.TableReservations.Add(res);
        await _context.SaveChangesAsync(ct);

        if (dto.TableId.HasValue)
        {
            if (await IsTableBusyAsync(dto.TableId.Value, startLocal, endLocal, res.Id, ct))
            {
                await tx.RollbackAsync(ct);
                return ReservationActionResult.Fail("La mesa indicada ya está reservada en esa ventana", "CONFLICT");
            }
            _context.ReservationTables.Add(new ReservationTable { ReservationId = res.Id, TableId = dto.TableId.Value });
            await _context.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);
        await SafeNotifyAsync(() => _notify.SendConfirmationAsync(res.Id, ct));

        return new ReservationActionResult
        {
            Success = true,
            ReservationId = res.Id,
            ConfirmationCode = res.ConfirmationCode,
            Status = res.Status.ToString(),
            ReservationDateTime = startLocal.ToString("yyyy-MM-ddTHH:mm:ss"),
            AssignedTableIds = dto.TableId.HasValue ? new List<int> { dto.TableId.Value } : null,
        };
    }

    public async Task<ReservationActionResult> ConfirmAsync(int id, string? rowVersion, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        if (res.Status is ReservationStatus.Cancelled or ReservationStatus.Expired or ReservationStatus.NoShow)
            return ReservationActionResult.Fail("La reserva no está activa", "BAD_STATE");

        ApplyRowVersion(res, rowVersion);
        res.Status = ReservationStatus.Confirmed;
        res.HoldExpiresAt = null;
        SyncLegacyFlags(res);
        try { await _context.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Stale(); }

        await SafeNotifyAsync(() => _notify.SendConfirmationAsync(res.Id, ct));
        return Ok(res);
    }

    // ─────────────────────────── Asignación de mesa ───────────────────────────

    public async Task<ReservationActionResult> AssignTableAsync(int id, AssignTableDto dto, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.Include(r => r.AssignedTables).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        // El host puede aceptar/sentar reservas vencidas (No-Show / Expired): el cliente
        // llegó tarde → al asignarles mesa se re-activan a Confirmed y se traen a "ahora".
        // Solo se bloquean las canceladas y las ya completadas.
        if (res.Status is ReservationStatus.Cancelled or ReservationStatus.Completed)
            return ReservationActionResult.Fail("La reserva no está activa", "BAD_STATE");

        var tableIds = (dto.TableIds is { Count: > 0 })
            ? dto.TableIds.Distinct().ToList()
            : (dto.TableId.HasValue ? new List<int> { dto.TableId.Value } : new List<int>());
        if (tableIds.Count == 0)
            return ReservationActionResult.Fail("Debe indicar al menos una mesa", "BAD_INPUT");

        // Re-activación de una reserva vencida (No-Show / Expired): el cliente llegó tarde.
        // La traemos a "ahora" conservando su duración ANTES de validar disponibilidad, para
        // que el lock y el chequeo de solape usen la ventana real (hoy) — evita doble-reserva —
        // y para que el barrido de ciclo de vida no la vuelva a marcar No-Show (exige hora < corte).
        if (res.Status is ReservationStatus.NoShow or ReservationStatus.Expired)
        {
            var shift = RestaurantClock.Now - res.ReservationDateTime;
            res.ReservationDateTime = RestaurantClock.Now;
            res.EndDateTime = res.EndDateTime.Add(shift);
            res.ReservedUntil = res.EndDateTime;
            res.NoShowAt = null;
        }

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        foreach (var tid in tableIds)
        {
            if (!await TryAcquireAppLockAsync($"table:{tid}:{res.ReservationDateTime:yyyyMMdd}", ct))
            {
                await tx.RollbackAsync(ct);
                return ReservationActionResult.Fail("Mesa ocupada por otra operación, reintenta", "BUSY");
            }
        }
        foreach (var tid in tableIds)
        {
            if (await IsTableBusyAsync(tid, res.ReservationDateTime, res.EndDateTime, res.Id, ct))
            {
                await tx.RollbackAsync(ct);
                return ReservationActionResult.Fail($"La mesa {tid} ya está reservada en esa ventana", "CONFLICT");
            }
        }

        ApplyRowVersion(res, dto.RowVersion);
        _context.ReservationTables.RemoveRange(res.AssignedTables);
        foreach (var tid in tableIds)
            _context.ReservationTables.Add(new ReservationTable { ReservationId = res.Id, TableId = tid });
        res.TableId = tableIds[0];
        // Pending → Confirmed (flujo normal). NoShow/Expired ya fueron traídas a "ahora"
        // arriba; aquí se confirman (el host las aceptó porque el cliente llegó tarde).
        if (res.Status is ReservationStatus.Pending or ReservationStatus.NoShow or ReservationStatus.Expired)
        {
            res.Status = ReservationStatus.Confirmed;
            res.HoldExpiresAt = null;
        }
        SyncLegacyFlags(res);
        try { await _context.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { await tx.RollbackAsync(ct); return Stale(); }
        await tx.CommitAsync(ct);

        var r2 = Ok(res);
        r2.AssignedTableIds = tableIds;
        return r2;
    }

    public async Task<ReservationActionResult> AutoAssignAsync(int id, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        // Igual que AssignTableAsync: se admiten vencidas (No-Show / Expired); se re-activan
        // al asignarles mesa. Solo se bloquean canceladas y completadas.
        if (res.Status is ReservationStatus.Cancelled or ReservationStatus.Completed)
            return ReservationActionResult.Fail("La reserva no está activa", "BAD_STATE");

        var candidates = await _context.Tables
            .Where(t => t.Zone.Type == "Dining" && t.Capacity >= res.NumberOfGuests
                     && (res.RequestedZoneId == null || t.ZoneId == res.RequestedZoneId))
            .OrderBy(t => t.Capacity).ThenBy(t => t.Id)
            .Select(t => t.Id)
            .ToListAsync(ct);

        foreach (var tid in candidates)
        {
            if (!await IsTableBusyAsync(tid, res.ReservationDateTime, res.EndDateTime, res.Id, ct))
                return await AssignTableAsync(id, new AssignTableDto { TableId = tid }, ct);
        }
        return ReservationActionResult.Fail("No hay mesa libre para auto-asignar en esa ventana", "NO_TABLE");
    }

    // ─────────────────────────── Sentar (seat) ───────────────────────────

    public async Task<ReservationActionResult> SeatAsync(int id, SeatReservationDto dto, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        if (res.Status is ReservationStatus.Cancelled or ReservationStatus.Expired or ReservationStatus.NoShow)
            return ReservationActionResult.Fail("La reserva no está activa", "BAD_STATE");
        if (res.Status == ReservationStatus.Seated)
            return ReservationActionResult.Fail("La reserva ya está sentada", "BAD_STATE");

        int? tableId = dto.TableId ?? res.TableId;
        if (tableId == null)
        {
            var auto = await AutoAssignAsync(id, ct);
            if (!auto.Success) return auto;
            tableId = auto.AssignedTableIds?.FirstOrDefault();
            if (tableId == null) return ReservationActionResult.Fail("No se pudo asignar mesa", "NO_TABLE");
        }

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        if (!await TryAcquireAppLockAsync($"table:{tableId.Value}:{res.ReservationDateTime:yyyyMMdd}", ct))
        {
            await tx.RollbackAsync(ct);
            return ReservationActionResult.Fail("Mesa ocupada por otra operación, reintenta", "BUSY");
        }

        var table = await _context.Tables.FirstOrDefaultAsync(t => t.Id == tableId.Value, ct);
        if (table == null) { await tx.RollbackAsync(ct); return ReservationActionResult.Fail("Mesa no encontrada", "NOT_FOUND"); }

        var session = new TableSession
        {
            TableId = tableId.Value,
            NumberOfGuests = dto.NumberOfGuests ?? res.NumberOfGuests,
            AssignedByHostId = dto.HostId,
            AssignedWaiterId = dto.WaiterId,
            StartTime = DateTime.UtcNow,
            IsActive = true,
        };
        _context.TableSessions.Add(session);
        table.Status = TableStatus.Occupied;
        await _context.SaveChangesAsync(ct);

        res.TableSessionId = session.Id;
        res.TableId = tableId.Value;
        res.Status = ReservationStatus.Seated;
        res.SeatedAt = RestaurantClock.Now;
        SyncLegacyFlags(res);
        await _context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        // Plano en vivo: al sentar la reserva la mesa queda ocupada (aditivo; no afecta el seat).
        try
        {
            await _tableNotifier.TableStatusChangedAsync(tableId.Value, nameof(TableStatus.Occupied));
            if (session.AssignedWaiterId != null)
            {
                var w = await _context.Users.AsNoTracking()
                    .Where(u => u.Id == session.AssignedWaiterId.Value)
                    .Select(u => new { u.FirstName, u.LastName })
                    .FirstOrDefaultAsync(ct);
                await _tableNotifier.TableWaiterChangedAsync(tableId.Value,
                    NameFormatting.Initials(w?.FirstName, w?.LastName),
                    NameFormatting.FullName(w?.FirstName, w?.LastName));
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo difundir el estado al sentar la reserva {ReservationId}", res.Id);
        }

        var result = Ok(res);
        result.TableSessionId = session.Id;
        result.AssignedTableIds = new List<int> { tableId.Value };
        return result;
    }

    // ─────────────────────────── No-show / cancel / reschedule ───────────────────────────

    public async Task<ReservationActionResult> MarkNoShowAsync(int id, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        if (res.Status is not (ReservationStatus.Pending or ReservationStatus.Confirmed))
            return ReservationActionResult.Fail("Solo reservas pendientes/confirmadas pueden marcarse no-show", "BAD_STATE");

        res.Status = ReservationStatus.NoShow;
        res.NoShowAt = RestaurantClock.Now;
        SyncLegacyFlags(res);
        await _context.SaveChangesAsync(ct);
        await SafeNotifyAsync(() => _notify.SendNoShowAsync(res.Id, ct));
        return Ok(res);
    }

    public async Task<ReservationActionResult> CancelAsync(int id, CancelReservationDto dto, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");

        // Cancelación pública requiere el código (capability).
        if (!string.IsNullOrWhiteSpace(dto.ConfirmationCode)
            && !string.Equals(dto.ConfirmationCode, res.ConfirmationCode, StringComparison.OrdinalIgnoreCase))
            return ReservationActionResult.Fail("Código de confirmación inválido", "BAD_CODE");

        if (res.Status is ReservationStatus.Cancelled or ReservationStatus.Completed)
            return Ok(res); // idempotente

        ApplyRowVersion(res, dto.RowVersion);
        res.Status = ReservationStatus.Cancelled;
        res.CancelledAt = RestaurantClock.Now;
        res.CancelReason = dto.Reason;
        res.HoldExpiresAt = null;
        SyncLegacyFlags(res);
        try { await _context.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Stale(); }
        return Ok(res);
    }

    public async Task<ReservationActionResult> RescheduleAsync(int id, RescheduleReservationDto dto, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        if (res.Status is ReservationStatus.Cancelled or ReservationStatus.Expired or ReservationStatus.NoShow or ReservationStatus.Completed)
            return ReservationActionResult.Fail("La reserva no está activa", "BAD_STATE");

        var startLocal = DateTime.SpecifyKind(dto.NewDateTime, DateTimeKind.Unspecified);
        var date = DateOnly.FromDateTime(startLocal);
        var time = TimeOnly.FromDateTime(startLocal);
        var period = await ResolvePeriodAsync(date, time, ct);
        if (period == null)
            return ReservationActionResult.Fail("No hay servicio disponible en ese horario", "NO_SERVICE");

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        if (!await TryAcquireAppLockAsync(SlotLockKey(period, startLocal), ct))
        {
            await tx.RollbackAsync(ct);
            return ReservationActionResult.Fail("Demasiadas solicitudes, reintenta", "BUSY");
        }

        var feas = await _availability.CheckSlotAsync(period, startLocal, res.NumberOfGuests, res.RequestedZoneId, res.Id, ct);
        if (!feas.Bookable)
        {
            await tx.RollbackAsync(ct);
            return ReservationActionResult.Fail("El nuevo horario no tiene capacidad disponible", "SLOT_FULL");
        }

        int duration = ReservationMath.ResolveDuration(period, res.NumberOfGuests);
        ApplyRowVersion(res, dto.RowVersion);
        res.ReservationDateTime = startLocal;
        res.DurationMinutes = duration;
        res.EndDateTime = startLocal.AddMinutes(duration + period.TurnoverBufferMinutes);
        res.ReservedUntil = res.EndDateTime;
        res.ServicePeriodId = period.Id;
        try { await _context.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { await tx.RollbackAsync(ct); return Stale(); }
        await tx.CommitAsync(ct);

        var result = Ok(res);
        result.ReservationDateTime = startLocal.ToString("yyyy-MM-ddTHH:mm:ss");
        return result;
    }

    // ─────────────────────────── Reserva de ZONA completa (exclusiva) ───────────────────────────

    public async Task<ReservationActionResult> CreateZoneRequestAsync(ZoneRequestDto dto, CancellationToken ct = default)
    {
        if (!DateOnly.TryParse(dto.Date, out var date) || !TimeOnly.TryParse(dto.Time, out var time))
            return ReservationActionResult.Fail("Fecha u hora inválida", "BAD_INPUT");
        if (dto.Guests < 1)
            return ReservationActionResult.Fail("Número de comensales inválido", "BAD_INPUT");
        if (dto.ZoneId <= 0)
            return ReservationActionResult.Fail("Debe elegir una zona", "BAD_INPUT");
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone))
            return ReservationActionResult.Fail("Nombre y teléfono son obligatorios", "BAD_INPUT");

        var zone = await _context.Zones.FirstOrDefaultAsync(z => z.Id == dto.ZoneId && z.Type == "Dining" && z.IsActive, ct);
        if (zone == null)
            return ReservationActionResult.Fail("Zona no válida", "BAD_INPUT");

        var startLocal = date.ToDateTime(time);
        // Para una solicitud de zona NO bloqueamos por pacing: el host decide si es posible.
        // Igual resolvemos el turno (si existe) para la duración/ventana usadas al chequear solape.
        var period = await ResolvePeriodAsync(date, time, ct);
        int duration = period != null ? ReservationMath.ResolveDuration(period, dto.Guests) : 120;
        int buffer = period?.TurnoverBufferMinutes ?? 0;
        var endLocal = startLocal.AddMinutes(duration + buffer);

        var res = new TableReservation
        {
            Status = ReservationStatus.Pending,
            Source = "Portal",
            IsZoneExclusive = true,
            NumberOfGuests = dto.Guests,
            RequestedZoneId = dto.ZoneId,
            ReservationDateTime = startLocal,
            DurationMinutes = duration,
            EndDateTime = endLocal,
            ReservedUntil = endLocal,
            ServicePeriodId = period?.Id,
            ConfirmationCode = GenerateCode(),
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            CustomerEmail = dto.CustomerEmail?.Trim(),
            OccasionType = (OccasionType)dto.OccasionType,
            SpecialRequests = dto.SpecialRequests,
            DepositStatus = "None",
        };
        SyncLegacyFlags(res);
        _context.TableReservations.Add(res);
        await _context.SaveChangesAsync(ct);

        return new ReservationActionResult
        {
            Success = true,
            ReservationId = res.Id,
            ConfirmationCode = res.ConfirmationCode,
            Status = res.Status.ToString(),
            ReservationDateTime = startLocal.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
    }

    public async Task<ReservationActionResult> RespondZoneAsync(int id, ZoneDecisionDto dto, CancellationToken ct = default)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return ReservationActionResult.Fail("Reserva no encontrada", "NOT_FOUND");
        if (res.Status is ReservationStatus.Cancelled or ReservationStatus.Completed)
            return ReservationActionResult.Fail("La reserva no está activa", "BAD_STATE");

        if (dto.Accept)
        {
            if (res.RequestedZoneId == null)
                return ReservationActionResult.Fail("La reserva no tiene zona solicitada", "BAD_INPUT");
            // Aceptar = bloquear TODA la zona: asignar todas sus mesas Dining a esta reserva.
            // AssignTableAsync revalida solapes → si la zona no está libre devuelve CONFLICT (= "no es posible").
            var zoneTableIds = await _context.Tables
                .Where(t => t.ZoneId == res.RequestedZoneId && t.Zone.Type == "Dining")
                .Select(t => t.Id).ToListAsync(ct);
            if (zoneTableIds.Count == 0)
                return ReservationActionResult.Fail("La zona no tiene mesas", "BAD_INPUT");

            var result = await AssignTableAsync(id, new AssignTableDto { TableIds = zoneTableIds }, ct);
            if (result.Success)
            {
                res.HostResponseMessage = dto.Message;   // mismo objeto trackeado → persiste el mensaje
                await _context.SaveChangesAsync(ct);
            }
            return result;
        }
        else
        {
            var result = await CancelAsync(id, new CancelReservationDto { Reason = dto.Message ?? "Zona no disponible" }, ct);
            if (result.Success)
            {
                res.HostResponseMessage = dto.Message;
                await _context.SaveChangesAsync(ct);
            }
            return result;
        }
    }

    public async Task<ReservationTrackDto?> GetTrackAsync(string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        var res = await _context.TableReservations
            .Include(r => r.RequestedZone)
            .Include(r => r.Table).ThenInclude(t => t!.Zone)
            .Include(r => r.AssignedTables)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.ConfirmationCode == code, ct);
        if (res == null) return null;
        return new ReservationTrackDto
        {
            Status = res.Status.ToString(),
            IsZoneExclusive = res.IsZoneExclusive,
            ZoneName = res.RequestedZone?.Name ?? res.Table?.Zone?.Name,
            ReservationDateTime = res.ReservationDateTime.ToString("yyyy-MM-ddTHH:mm:ss"),
            NumberOfGuests = res.NumberOfGuests,
            OccasionType = (int)res.OccasionType,
            HostResponseMessage = res.HostResponseMessage,
            AssignedTableCount = res.AssignedTables.Count,
            CustomerName = res.CustomerName,
        };
    }

    // ─────────────────────────── Helpers ───────────────────────────

    private async Task<ServicePeriod?> ResolvePeriodAsync(DateOnly date, TimeOnly time, CancellationToken ct)
    {
        int dayBit = ReservationMath.DayBit(date.DayOfWeek);
        var periods = await _context.ServicePeriods
            .Where(p => p.IsActive && (p.DaysOfWeekMask & dayBit) != 0)
            .OrderBy(p => p.StartTime)
            .ToListAsync(ct);
        return periods.FirstOrDefault(p => p.StartTime <= time && time < p.EndTime);
    }

    private static string SlotLockKey(ServicePeriod period, DateTime startLocal)
    {
        int minute = startLocal.Hour * 60 + startLocal.Minute;
        int aligned = (minute / Math.Max(1, period.SlotMinutes)) * Math.Max(1, period.SlotMinutes);
        var bucket = startLocal.Date.AddMinutes(aligned).ToString("yyyyMMddHHmm");
        return $"resv:{period.RestaurantId}:{period.Id}:{bucket}";
    }

    /// <summary>sp_getapplock Exclusive (LockOwner=Transaction) sobre la conexión de la transacción actual.</summary>
    private async Task<bool> TryAcquireAppLockAsync(string resource, CancellationToken ct, int timeoutMs = 5000)
    {
        var conn = _context.Database.GetDbConnection();
        var dbTx = _context.Database.CurrentTransaction?.GetDbTransaction();
        await using var cmd = conn.CreateCommand();
        cmd.Transaction = dbTx;
        cmd.CommandType = CommandType.StoredProcedure;
        cmd.CommandText = "sp_getapplock";
        cmd.Parameters.Add(new SqlParameter("@Resource", resource));
        cmd.Parameters.Add(new SqlParameter("@LockMode", "Exclusive"));
        cmd.Parameters.Add(new SqlParameter("@LockOwner", "Transaction"));
        cmd.Parameters.Add(new SqlParameter("@LockTimeout", timeoutMs));
        var ret = new SqlParameter { ParameterName = "@ret", Direction = ParameterDirection.ReturnValue, SqlDbType = SqlDbType.Int };
        cmd.Parameters.Add(ret);
        await cmd.ExecuteNonQueryAsync(ct);
        return ret.Value is int code && code >= 0;
    }

    private async Task<bool> IsTableBusyAsync(int tableId, DateTime start, DateTime end, int excludeId, CancellationToken ct)
    {
        bool byField = await _context.TableReservations.AnyAsync(r =>
            ReservationMath.ActiveStatuses.Contains(r.Status)
            && r.Id != excludeId
            && r.TableId == tableId
            && r.ReservationDateTime < end && start < r.EndDateTime, ct);
        if (byField) return true;

        return await _context.ReservationTables.AnyAsync(rt =>
            rt.TableId == tableId
            && rt.ReservationId != excludeId
            && ReservationMath.ActiveStatuses.Contains(rt.Reservation.Status)
            && rt.Reservation.ReservationDateTime < end && start < rt.Reservation.EndDateTime, ct);
    }

    private void ApplyRowVersion(TableReservation res, string? rowVersionBase64)
    {
        if (string.IsNullOrWhiteSpace(rowVersionBase64)) return;
        try
        {
            _context.Entry(res).Property(r => r.RowVersion).OriginalValue = Convert.FromBase64String(rowVersionBase64);
        }
        catch (FormatException) { /* rowVersion malformado → se ignora la verificación optimista */ }
    }

    private static void SyncLegacyFlags(TableReservation r) => ReservationMath.SyncLegacyFlags(r);

    private static string GenerateCode()
        => "SM-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    private async Task SafeNotifyAsync(Func<Task> action)
    {
        try { await action(); }
        catch (Exception ex) { _logger.LogWarning(ex, "Notificación de reserva falló (no bloqueante)"); }
    }

    private static ReservationActionResult Stale() =>
        ReservationActionResult.Fail("La reserva fue modificada por otro usuario, recarga", "STALE");

    private static ReservationActionResult Ok(TableReservation res) => new()
    {
        Success = true,
        ReservationId = res.Id,
        ConfirmationCode = res.ConfirmationCode,
        Status = res.Status.ToString(),
        HoldExpiresAt = res.HoldExpiresAt,
    };
}
