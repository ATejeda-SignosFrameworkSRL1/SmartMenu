namespace SmartMenu.Domain.Entities;

public class TableReservation : BaseEntity
{
    public int TableId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int NumberOfGuests { get; set; }
    public DateTime ReservationDateTime { get; set; }
    public string? SpecialRequests { get; set; }
    public bool IsConfirmed { get; set; } = false;
    public bool IsCancelled { get; set; } = false;
    /// <summary>Origin: "Internal" (host), "Portal" (public site)</summary>
    public string Source { get; set; } = "Internal";
    /// <summary>Si la mesa no se usa antes de este momento, queda liberada (evitar roces con reserva).</summary>
    public DateTime? ReservedUntil { get; set; }
    /// <summary>Minutos antes de la reserva en que la mesa pasa a estado Reserved (default 60).</summary>
    public int AdvanceBlockMinutes { get; set; } = 60;
    /// <summary>Cuándo se envió el link de confirmación por WS (1-2h antes).</summary>
    public DateTime? ConfirmationLinkSentAt { get; set; }
    /// <summary>Link enviado al cliente para confirmar asistencia.</summary>
    public string? ConfirmationLink { get; set; }
    public int? CreatedByHostId { get; set; }
    
    // Navigation properties
    public Table Table { get; set; } = null!;
    public User? CreatedByHost { get; set; }
    public ReservationPreOrder? PreOrder { get; set; }
}
