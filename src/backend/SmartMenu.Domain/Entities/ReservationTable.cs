namespace SmartMenu.Domain.Entities;

/// <summary>
/// Join reserva↔mesa. Permite asignar una combinación de mesas a una sola reserva
/// (grupos grandes). En v1 el auto-asignador solo intenta una mesa, pero el esquema
/// admite combos (seam listo para fase 2). PK compuesta (ReservationId, TableId).
/// </summary>
public class ReservationTable
{
    public int ReservationId { get; set; }
    public int TableId { get; set; }

    public TableReservation Reservation { get; set; } = null!;
    public Table Table { get; set; } = null!;
}
