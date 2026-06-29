using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.Application.Common;

/// <summary>
/// Cálculo PURO (sin EF/DB) del estado efectivo de una mesa: combina el estado base
/// (Table.Status) con la reserva dinámica. ÚNICO lugar donde vive esta regla — reusado por
/// FloorPlanController, TableController y el broadcaster de SignalR (ITableStatusBroadcaster),
/// para no duplicar el cálculo.
/// </summary>
public static class TableStatusEvaluator
{
    /// <summary>
    /// ¿Esta reserva BLOQUEA su mesa AHORA? La ventana de bloqueo abre AdvanceBlockMinutes antes
    /// de la hora reservada y cierra al terminar la estadía:
    /// [ReservationDateTime - AdvanceBlockMinutes, EndDateTime). Usar SOLO con reservas en
    /// ReservationMath.ActiveStatuses y con mesa asignada. `nowLocal` = hora local del restaurante.
    /// </summary>
    public static bool IsBlockingNow(TableReservation r, DateTime nowLocal)
        => nowLocal >= r.ReservationDateTime.AddMinutes(-r.AdvanceBlockMinutes)
           && nowLocal < r.EndDateTime;

    /// <summary>
    /// Estado EFECTIVO de una mesa: Available + reserva bloqueando ahora → Reserved;
    /// Reserved sin reserva bloqueando → Available; en cualquier otro caso, el estado base.
    /// Cada caller formatea el casing (`.ToString()` PascalCase para SignalR/API de mesas;
    /// `.ToLowerInvariant()` para TableData.status del plano @smartmenu/ui).
    /// </summary>
    public static TableStatus EffectiveStatus(TableStatus baseStatus, bool hasActiveReservationNow)
    {
        if (baseStatus == TableStatus.Available && hasActiveReservationNow) return TableStatus.Reserved;
        if (baseStatus == TableStatus.Reserved && !hasActiveReservationNow) return TableStatus.Available;
        return baseStatus;
    }
}
