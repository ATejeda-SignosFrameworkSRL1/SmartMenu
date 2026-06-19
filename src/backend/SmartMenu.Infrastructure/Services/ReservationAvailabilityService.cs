using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartMenu.Application.Common;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.Application.Settings;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Services;

/// <summary>
/// Motor de disponibilidad por intervalo. Construye la rejilla de slots por turno y, para cada
/// slot, evalúa (a) pacing (topes de comensales/reservas que INICIAN en el slot) y (b) factibilidad
/// física (existe una mesa Dining que sirva al party, libre en la ventana [inicio, inicio+duración+colchón)).
/// </summary>
public class ReservationAvailabilityService : IReservationAvailabilityService
{
    private readonly ApplicationDbContext _context;
    private readonly ReservationSettings _settings;

    public ReservationAvailabilityService(ApplicationDbContext context, IOptions<ReservationSettings> settings)
    {
        _context = context;
        _settings = settings.Value;
    }

    public async Task<AvailabilityResultDto> GetSlotsAsync(DateOnly date, int partySize, int? zoneId, CancellationToken ct = default)
    {
        var result = new AvailabilityResultDto
        {
            Date = date.ToString("yyyy-MM-dd"),
            Guests = partySize,
            ZoneId = zoneId,
        };
        if (partySize < 1) return result;

        var now = RestaurantClock.Now;
        var today = RestaurantClock.Today;
        int dayBit = ReservationMath.DayBit(date.DayOfWeek);

        var periods = await _context.ServicePeriods
            .Where(p => p.IsActive && (p.DaysOfWeekMask & dayBit) != 0)
            .OrderBy(p => p.StartTime)
            .ToListAsync(ct);
        if (periods.Count == 0) return result;

        result.SlotMinutes = periods[0].SlotMinutes;

        foreach (var p in periods)
        {
            if (date > today.AddDays(p.MaxHorizonDays)) continue;

            int startMin = p.StartTime.Hour * 60 + p.StartTime.Minute;
            int endMin = p.EndTime.Hour * 60 + p.EndTime.Minute;
            if (endMin <= startMin || p.SlotMinutes <= 0) continue;

            result.ServiceWindows.Add(new ServiceWindowDto(
                p.Name, p.StartTime.ToString("HH:mm"), p.EndTime.ToString("HH:mm")));

            int duration = ReservationMath.ResolveDuration(p, partySize);

            for (int m = startMin; m < endMin; m += p.SlotMinutes)
            {
                var t = new TimeOnly(m / 60, m % 60);
                var startLocal = date.ToDateTime(t);
                bool isPast = startLocal < now;
                bool withinLead = startLocal < now.AddMinutes(p.LeadTimeMinutes);

                if (isPast || withinLead)
                {
                    result.Slots.Add(new SlotDto(t.ToString("HH:mm"), "full", 0, isPast));
                    continue;
                }

                var feas = await CheckSlotCoreAsync(p, startLocal, duration, partySize, zoneId, null, ct);
                string status = !feas.Bookable
                    ? "full"
                    : (feas.RemainingCovers <= _settings.LimitedThreshold ? "limited" : "available");
                int remaining = feas.RemainingCovers == int.MaxValue ? 999 : Math.Max(0, feas.RemainingCovers);
                result.Slots.Add(new SlotDto(t.ToString("HH:mm"), status, remaining, false));
            }
        }

        return result;
    }

    public Task<SlotFeasibility> CheckSlotAsync(ServicePeriod period, DateTime startLocal, int partySize, int? zoneId, int? excludeReservationId, CancellationToken ct = default)
    {
        int duration = ReservationMath.ResolveDuration(period, partySize);
        return CheckSlotCoreAsync(period, startLocal, duration, partySize, zoneId, excludeReservationId, ct);
    }

    private async Task<SlotFeasibility> CheckSlotCoreAsync(ServicePeriod p, DateTime startLocal, int duration, int party, int? zoneId, int? excludeId, CancellationToken ct)
    {
        var slotEnd = startLocal.AddMinutes(p.SlotMinutes);
        var windowEnd = startLocal.AddMinutes(duration + p.TurnoverBufferMinutes);

        int exclude = excludeId ?? -1;
        // ── Pacing: reservas activas que INICIAN en [startLocal, slotEnd) ──
        var startingGuests = await _context.TableReservations
            .Where(r => ReservationMath.ActiveStatuses.Contains(r.Status)
                     && r.Id != exclude
                     && r.ReservationDateTime >= startLocal && r.ReservationDateTime < slotEnd)
            .Select(r => r.NumberOfGuests)
            .ToListAsync(ct);

        int committedCovers = startingGuests.Sum();
        int committedRes = startingGuests.Count;

        bool pacingOk =
            (p.MaxCoversPerSlot <= 0 || committedCovers + party <= p.MaxCoversPerSlot)
            && (p.MaxReservationsPerSlot <= 0 || committedRes < p.MaxReservationsPerSlot);

        int remaining = p.MaxCoversPerSlot <= 0 ? int.MaxValue : Math.Max(0, p.MaxCoversPerSlot - committedCovers);

        if (!pacingOk) return new SlotFeasibility(false, remaining);

        bool physical = await HasFreeTableAsync(startLocal, windowEnd, party, zoneId, excludeId, ct);
        return new SlotFeasibility(physical, remaining);
    }

    // ─────────────────────── Calendario: ocupación por bloque ───────────────────────

    public async Task<OccupancyResultDto> GetOccupancyAsync(DateOnly date, CancellationToken ct = default)
    {
        var result = new OccupancyResultDto { Date = date.ToString("yyyy-MM-dd") };

        int dayBit = ReservationMath.DayBit(date.DayOfWeek);
        var periods = await _context.ServicePeriods
            .Where(p => p.IsActive && (p.DaysOfWeekMask & dayBit) != 0)
            .OrderBy(p => p.StartTime)
            .ToListAsync(ct);
        if (periods.Count == 0) return result;

        result.SlotMinutes = periods[0].SlotMinutes;

        // Carga UNA vez las reservas activas que INICIAN en el día (pacing) y agrega en memoria.
        var dayStart = date.ToDateTime(TimeOnly.MinValue);
        var dayEnd = dayStart.AddDays(1);
        var starting = await _context.TableReservations
            .Where(r => ReservationMath.ActiveStatuses.Contains(r.Status)
                     && r.ReservationDateTime >= dayStart && r.ReservationDateTime < dayEnd)
            .Select(r => new { r.ReservationDateTime, r.NumberOfGuests })
            .ToListAsync(ct);

        foreach (var p in periods)
        {
            int startMin = p.StartTime.Hour * 60 + p.StartTime.Minute;
            int endMin = p.EndTime.Hour * 60 + p.EndTime.Minute;
            if (endMin <= startMin || p.SlotMinutes <= 0) continue;

            result.ServiceWindows.Add(new ServiceWindowDto(
                p.Name, p.StartTime.ToString("HH:mm"), p.EndTime.ToString("HH:mm")));

            for (int m = startMin; m < endMin; m += p.SlotMinutes)
            {
                var t = new TimeOnly(m / 60, m % 60);
                var slotStart = date.ToDateTime(t);
                var slotEnd = slotStart.AddMinutes(p.SlotMinutes);

                // Misma lógica de pacing que CheckSlotCoreAsync: reservas que INICIAN en [slotStart, slotEnd).
                int covers = 0, reservations = 0;
                foreach (var r in starting)
                {
                    if (r.ReservationDateTime >= slotStart && r.ReservationDateTime < slotEnd)
                    {
                        covers += r.NumberOfGuests;
                        reservations++;
                    }
                }

                bool full = (p.MaxCoversPerSlot > 0 && covers >= p.MaxCoversPerSlot)
                         || (p.MaxReservationsPerSlot > 0 && reservations >= p.MaxReservationsPerSlot);
                string status = full
                    ? "full"
                    : (p.MaxCoversPerSlot > 0 && (p.MaxCoversPerSlot - covers) <= _settings.LimitedThreshold
                        ? "limited"
                        : "available");

                result.Blocks.Add(new OccupancyBlockDto(
                    t.ToString("HH:mm"), covers, p.MaxCoversPerSlot, reservations, p.MaxReservationsPerSlot, status));
            }
        }

        return result;
    }

    // ─────────────────────── Calendario: disponibilidad por mesa ───────────────────────

    public async Task<TableAvailabilityResultDto> GetTableAvailabilityAsync(DateOnly date, CancellationToken ct = default)
    {
        var result = new TableAvailabilityResultDto { Date = date.ToString("yyyy-MM-dd") };

        int dayBit = ReservationMath.DayBit(date.DayOfWeek);
        var periods = await _context.ServicePeriods
            .Where(p => p.IsActive && (p.DaysOfWeekMask & dayBit) != 0)
            .OrderBy(p => p.StartTime)
            .ToListAsync(ct);
        if (periods.Count == 0) return result;

        result.SlotMinutes = periods[0].SlotMinutes;

        // Mesas candidatas: todas las Dining (orden estable).
        var tables = await _context.Tables
            .Where(t => t.Zone.Type == "Dining")
            .OrderBy(t => t.TableNumber).ThenBy(t => t.Id)
            .Select(t => new { t.Id, t.TableNumber, t.Capacity, ZoneName = t.Zone.Name })
            .ToListAsync(ct);
        if (tables.Count == 0) return result;

        // Carga UNA vez todas las reservas activas ASIGNADAS que INICIAN en el día, con su ventana
        // y la(s) mesa(s) ocupada(s) (TableId directo + filas del join). Solape en memoria por mesa/slot.
        var dayStart = date.ToDateTime(TimeOnly.MinValue);
        var dayEnd = dayStart.AddDays(1);

        var byField = await _context.TableReservations
            .Where(r => ReservationMath.ActiveStatuses.Contains(r.Status)
                     && r.TableId != null
                     && r.ReservationDateTime >= dayStart && r.ReservationDateTime < dayEnd)
            .Select(r => new { TableId = r.TableId!.Value, r.ReservationDateTime, r.EndDateTime })
            .ToListAsync(ct);

        var byJoin = await _context.ReservationTables
            .Where(rt => ReservationMath.ActiveStatuses.Contains(rt.Reservation.Status)
                      && rt.Reservation.ReservationDateTime >= dayStart && rt.Reservation.ReservationDateTime < dayEnd)
            .Select(rt => new { rt.TableId, rt.Reservation.ReservationDateTime, rt.Reservation.EndDateTime })
            .ToListAsync(ct);

        // Índice: tableId -> lista de ventanas ocupadas [start, end).
        var busyByTable = new Dictionary<int, List<(DateTime Start, DateTime End)>>();
        void AddBusy(int tableId, DateTime start, DateTime end)
        {
            if (!busyByTable.TryGetValue(tableId, out var list))
                busyByTable[tableId] = list = new List<(DateTime, DateTime)>();
            list.Add((start, end));
        }
        foreach (var r in byField) AddBusy(r.TableId, r.ReservationDateTime, r.EndDateTime);
        foreach (var r in byJoin) AddBusy(r.TableId, r.ReservationDateTime, r.EndDateTime);

        var now = RestaurantClock.Now;
        bool isToday = date == RestaurantClock.Today;

        // Pre-computa la rejilla de slots del día (cada slot lleva su ventana estadía+colchón genérica).
        var slots = new List<(string Label, DateTime Start, DateTime WindowEnd)>();
        foreach (var p in periods)
        {
            int startMin = p.StartTime.Hour * 60 + p.StartTime.Minute;
            int endMin = p.EndTime.Hour * 60 + p.EndTime.Minute;
            if (endMin <= startMin || p.SlotMinutes <= 0) continue;

            // Duración genérica (party=2) + colchón de rotación, igual que el motor de factibilidad.
            int duration = ReservationMath.ResolveDuration(p, 2) + p.TurnoverBufferMinutes;

            for (int m = startMin; m < endMin; m += p.SlotMinutes)
            {
                var t = new TimeOnly(m / 60, m % 60);
                var slotStart = date.ToDateTime(t);
                if (isToday && slotStart < now) continue; // hoy: omite slots ya pasados
                slots.Add((t.ToString("HH:mm"), slotStart, slotStart.AddMinutes(duration)));
            }
        }

        foreach (var tbl in tables)
        {
            busyByTable.TryGetValue(tbl.Id, out var windows);
            var free = new List<string>();
            foreach (var s in slots)
            {
                // Libre ⟺ ninguna ventana ocupada solapa [slotStart, windowEnd).
                bool busy = windows != null && windows.Any(w =>
                    ReservationMath.Overlaps(w.Start, w.End, s.Start, s.WindowEnd));
                if (!busy) free.Add(s.Label);
            }

            result.Tables.Add(new TableAvailabilityDto
            {
                TableId = tbl.Id,
                TableNumber = tbl.TableNumber,
                ZoneName = tbl.ZoneName,
                Capacity = tbl.Capacity,
                FreeSlots = free,
            });
        }

        return result;
    }

    /// <summary>
    /// ¿Existe una mesa Dining (capacidad ≥ party, en la zona pedida si aplica) libre en
    /// [startLocal, windowEnd)? "Libre" = sin reserva activa ASIGNADA (TableId o join) que solape.
    /// MVP: no se consideran TableSessions de walk-in (se guardan en UTC; el pacing acota el agregado).
    /// </summary>
    private async Task<bool> HasFreeTableAsync(DateTime startLocal, DateTime windowEnd, int party, int? zoneId, int? excludeId, CancellationToken ct)
    {
        var candidates = await _context.Tables
            .Where(t => t.Zone.Type == "Dining" && t.Capacity >= party && (zoneId == null || t.ZoneId == zoneId))
            .Select(t => t.Id)
            .ToListAsync(ct);
        if (candidates.Count == 0) return false;
        int exclude = excludeId ?? -1;

        var busyByField = await _context.TableReservations
            .Where(r => ReservationMath.ActiveStatuses.Contains(r.Status)
                     && r.Id != exclude
                     && r.TableId != null
                     && r.ReservationDateTime < windowEnd && startLocal < r.EndDateTime)
            .Select(r => r.TableId!.Value)
            .ToListAsync(ct);

        var busyByJoin = await _context.ReservationTables
            .Where(rt => ReservationMath.ActiveStatuses.Contains(rt.Reservation.Status)
                      && rt.ReservationId != exclude
                      && rt.Reservation.ReservationDateTime < windowEnd && startLocal < rt.Reservation.EndDateTime)
            .Select(rt => rt.TableId)
            .ToListAsync(ct);

        var busy = new HashSet<int>(busyByField);
        busy.UnionWith(busyByJoin);

        return candidates.Any(id => !busy.Contains(id));
    }
}
