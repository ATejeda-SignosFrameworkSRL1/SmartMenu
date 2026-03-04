namespace SmartMenu.Domain.Entities;

/// <summary>
/// Solicitud de transferencia de mesas de un mesero a otro.
/// El mesero destino debe aceptar para que la transferencia se complete.
/// </summary>
public class TableTransferRequest : BaseEntity
{
    public int FromWaiterId { get; set; }
    public int ToWaiterId { get; set; }
    /// <summary>IDs de mesas a transferir (almacenados como JSON o en tabla relacionada).</summary>
    public string TableIdsJson { get; set; } = "[]"; // e.g. "[1,2,3]"
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
