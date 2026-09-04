using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class TableReservation : BaseEntity
{

    public int? TableId { get; set; }

    public int? RequestedZoneId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int NumberOfGuests { get; set; }
    public DateTime ReservationDateTime { get; set; }
    public string? SpecialRequests { get; set; }

    public OccasionType OccasionType { get; set; } = OccasionType.Casual;
    public bool IsConfirmed { get; set; } = false;
    public bool IsCancelled { get; set; } = false;

    public string Source { get; set; } = "Internal";

    public bool IsZoneExclusive { get; set; } = false;

    public string? HostResponseMessage { get; set; }

    public DateTime? ReservedUntil { get; set; }

    public int AdvanceBlockMinutes { get; set; } = 60;

    public DateTime? ConfirmationLinkSentAt { get; set; }

    public string? ConfirmationLink { get; set; }
    public int? CreatedByHostId { get; set; }

    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;

    public DateTime EndDateTime { get; set; }

    public int DurationMinutes { get; set; } = 90;

    public int? ServicePeriodId { get; set; }

    public DateTime? HoldExpiresAt { get; set; }
    public DateTime? SeatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? NoShowAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }

    public string? ConfirmationCode { get; set; }
    public DateTime? ReminderSentAt { get; set; }

    public int? TableSessionId { get; set; }

    public decimal? DepositAmount { get; set; }

    public string? DepositStatus { get; set; } = "None";

    [System.ComponentModel.DataAnnotations.Timestamp]
    public byte[]? RowVersion { get; set; }

    public Table? Table { get; set; }
    public Zone? RequestedZone { get; set; }
    public User? CreatedByHost { get; set; }
    public ReservationPreOrder? PreOrder { get; set; }
    public TableSession? TableSession { get; set; }
    public ServicePeriod? ServicePeriod { get; set; }
    public ICollection<ReservationTable> AssignedTables { get; set; } = new List<ReservationTable>();
}
