namespace SmartMenu.Domain.Entities;

public class ReservationTable
{
    public int ReservationId { get; set; }
    public int TableId { get; set; }

    public TableReservation Reservation { get; set; } = null!;
    public Table Table { get; set; } = null!;
}
