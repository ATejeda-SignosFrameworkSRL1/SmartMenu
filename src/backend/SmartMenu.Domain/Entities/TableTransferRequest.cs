namespace SmartMenu.Domain.Entities;

public class TableTransferRequest : BaseEntity
{
    public int FromWaiterId { get; set; }
    public int ToWaiterId { get; set; }

    public string TableIdsJson { get; set; } = "[]";
    public TransferStatus Status { get; set; } = TransferStatus.Pending;
    public int? RespondedByWaiterId { get; set; }
    public DateTime? RespondedAt { get; set; }

    public User FromWaiter { get; set; } = null!;
    public User ToWaiter { get; set; } = null!;
}

public enum TransferStatus
{
    Pending = 0,
    Accepted = 1,
    Rejected = 2
}
