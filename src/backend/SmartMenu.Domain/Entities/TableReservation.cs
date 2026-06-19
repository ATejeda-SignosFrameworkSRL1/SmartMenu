using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class TableReservation : BaseEntity
{
    /// <summary>
    /// Mesa específica. NULL cuando el cliente reservó vía portal eligiendo solo una zona
    /// y el host todavía no asigna mesa concreta.
    /// </summary>
    public int? TableId { get; set; }
    /// <summary>
    /// Zona elegida por el cliente en el portal (cuando aún no hay mesa específica).
    /// Si TableId está set, esto es informativo (zona de esa mesa).
    /// </summary>
    public int? RequestedZoneId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int NumberOfGuests { get; set; }
    public DateTime ReservationDateTime { get; set; }
    public string? SpecialRequests { get; set; }
    /// <summary>
    /// Tipo de ocasión (cumpleaños, aniversario, etc.). Default Casual.
    /// Permite al host anticipar arreglos especiales y filtrar por ocasión.
    /// </summary>
    public OccasionType OccasionType { get; set; } = OccasionType.Casual;
    public bool IsConfirmed { get; set; } = false;
    public bool IsCancelled { get; set; } = false;
    /// <summary>Origin: "Internal" (host), "Portal" (public site)</summary>
    public string Source { get; set; } = "Internal";
    /// <summary>Reserva de ZONA completa (uso exclusivo de toda la zona); el host aprueba/rechaza.</summary>
    public bool IsZoneExclusive { get; set; } = false;
    /// <summary>Mensaje del host al cliente al aprobar/rechazar (visible en el seguimiento por código).</summary>
    public string? HostResponseMessage { get; set; }
    /// <summary>Si la mesa no se usa antes de este momento, queda liberada (evitar roces con reserva).</summary>
    public DateTime? ReservedUntil { get; set; }
    /// <summary>Minutos antes de la reserva en que la mesa pasa a estado Reserved (default 60).</summary>
    public int AdvanceBlockMinutes { get; set; } = 60;
    /// <summary>Cuándo se envió el link de confirmación por WS (1-2h antes).</summary>
    public DateTime? ConfirmationLinkSentAt { get; set; }
    /// <summary>Link enviado al cliente para confirmar asistencia.</summary>
    public string? ConfirmationLink { get; set; }
    public int? CreatedByHostId { get; set; }

    // ─────────── Capacidad dinámica por intervalo (MVP) ───────────
    /// <summary>Estado del ciclo de vida (fuente de verdad). Los bool IsConfirmed/IsCancelled se sincronizan (dual-write).</summary>
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    /// <summary>Fin de la ventana ocupada = ReservationDateTime + DurationMinutes + colchón. Persistido para solape indexable.</summary>
    public DateTime EndDateTime { get; set; }
    /// <summary>Duración de la estadía resuelta al reservar (min).</summary>
    public int DurationMinutes { get; set; } = 90;
    /// <summary>Turno aplicado (para los topes de pacing). NULL en filas legacy.</summary>
    public int? ServicePeriodId { get; set; }
    /// <summary>Expira el hold del portal público si no se confirma. NULL una vez confirmada.</summary>
    public DateTime? HoldExpiresAt { get; set; }
    public DateTime? SeatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? NoShowAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
    /// <summary>Código corto para que el cliente confirme/gestione su reserva sin autenticación.</summary>
    public string? ConfirmationCode { get; set; }
    public DateTime? ReminderSentAt { get; set; }
    /// <summary>Sesión de mesa creada al sentar (enlace reserva→servicio real).</summary>
    public int? TableSessionId { get; set; }
    /// <summary>STUB depósito — ignorado por el motor en MVP.</summary>
    public decimal? DepositAmount { get; set; }
    /// <summary>STUB estado de depósito: None|Pending|Paid|Refunded.</summary>
    public string? DepositStatus { get; set; } = "None";

    /// <summary>Optimistic concurrency token (SQL Server rowversion).</summary>
    [System.ComponentModel.DataAnnotations.Timestamp]
    public byte[]? RowVersion { get; set; }

    // Navigation properties
    public Table? Table { get; set; }
    public Zone? RequestedZone { get; set; }
    public User? CreatedByHost { get; set; }
    public ReservationPreOrder? PreOrder { get; set; }
    public TableSession? TableSession { get; set; }
    public ServicePeriod? ServicePeriod { get; set; }
    public ICollection<ReservationTable> AssignedTables { get; set; } = new List<ReservationTable>();
}
