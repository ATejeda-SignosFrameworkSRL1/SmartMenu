namespace SmartMenu.Domain.Entities;

/// <summary>
/// Solicitud de un mesero para quedarse con una mesa.
/// Flujo: Mesero solicita → Admin aprueba/rechaza → Mesero recibe notificación.
/// </summary>
public class TableClaimRequest : BaseEntity
{
    public int WaiterId { get; set; }
    public int TableId { get; set; }
    public int? OrderId { get; set; }
    public ClaimRequestStatus Status { get; set; } = ClaimRequestStatus.Pending;
    public int? RespondedByAdminId { get; set; }
    public DateTime? RespondedAt { get; set; }
    public string? AdminNote { get; set; }

    // Navigation
    public User Waiter { get; set; } = null!;
    public Table Table { get; set; } = null!;
    public User? RespondedByAdmin { get; set; }
}

public enum ClaimRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}
