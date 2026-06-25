using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.Application.Common;

/// <summary>
/// Helpers puros del dominio de reservas (sin dependencias de EF/DB).
/// </summary>
public static class ReservationMath
{
    /// <summary>
    /// Estados que OCUPAN capacidad del pool. Cancelled/Expired/NoShow/Completed la liberan.
    /// </summary>
    // List (no array) — en .NET 10 array.Contains se enlaza a MemoryExtensions.Contains
    // (ReadOnlySpan) que el intérprete de expresiones de EF no puede evaluar. List.Contains
    // se traduce a SQL IN sin problema.
    public static readonly List<ReservationStatus> ActiveStatuses = new()
    {
        ReservationStatus.Pending,
        ReservationStatus.Confirmed,
        ReservationStatus.Seated,
    };

    /// <summary>Duración de la estadía (min) resuelta por turno y tamaño del party.</summary>
    public static int ResolveDuration(ServicePeriod period, int partySize)
        => (period.LargePartyThreshold.HasValue
            && partySize >= period.LargePartyThreshold.Value
            && period.LargePartyDurationMinutes.HasValue)
            ? period.LargePartyDurationMinutes.Value
            : period.DefaultDurationMinutes;

    /// <summary>Bit del bitmask de días para un DayOfWeek (Dom=1, Lun=2, … Sáb=64).</summary>
    public static int DayBit(DayOfWeek d) => 1 << (int)d;

    /// <summary>
    /// Predicado de solape de ventanas medio-abiertas [aStart,aEnd) y [bStart,bEnd):
    /// solapan ⟺ aStart &lt; bEnd &amp;&amp; bStart &lt; aEnd. Bordes que se tocan NO solapan.
    /// </summary>
    public static bool Overlaps(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd)
        => aStart < bEnd && bStart < aEnd;

    /// <summary>
    /// Sincroniza los bool legacy IsConfirmed/IsCancelled con el Status (fuente de verdad).
    /// Único lugar donde se define el mapeo — reusarlo en TODA transición de estado.
    /// </summary>
    public static void SyncLegacyFlags(TableReservation r)
    {
        r.IsCancelled = r.Status is ReservationStatus.Cancelled or ReservationStatus.Expired;
        r.IsConfirmed = r.Status is ReservationStatus.Confirmed or ReservationStatus.Seated or ReservationStatus.Completed;
    }

    /// <summary>
    /// ¿Esta reserva BLOQUEA su mesa AHORA? La ventana de bloqueo abre AdvanceBlockMinutes
    /// antes de la hora reservada y cierra al terminar la estadía:
    /// [ReservationDateTime - AdvanceBlockMinutes, EndDateTime). Usar SOLO con reservas en
    /// ActiveStatuses y con mesa asignada. `nowLocal` = hora local del restaurante.
    /// </summary>
    public static bool IsBlockingNow(TableReservation r, DateTime nowLocal)
        => nowLocal >= r.ReservationDateTime.AddMinutes(-r.AdvanceBlockMinutes)
           && nowLocal < r.EndDateTime;

    /// <summary>
    /// Estado EFECTIVO de una mesa combinando su estado base con la reserva dinámica:
    /// Available + reserva bloqueando ahora → Reserved; Reserved sin reserva bloqueando → Available;
    /// en cualquier otro caso, el estado base. Único lugar donde se define esta regla — reusar en
    /// FloorPlanController, TableController y la difusión por SignalR. Cada caller formatea el casing
    /// (`.ToString()` PascalCase para SignalR/API de mesas; `.ToLowerInvariant()` para el plano).
    /// </summary>
    public static TableStatus EffectiveStatus(TableStatus baseStatus, bool hasActiveReservationNow)
    {
        if (baseStatus == TableStatus.Available && hasActiveReservationNow) return TableStatus.Reserved;
        if (baseStatus == TableStatus.Reserved && !hasActiveReservationNow) return TableStatus.Available;
        return baseStatus;
    }
}
