namespace SmartMenu.Domain.Entities;

/// <summary>
/// Sprint 4.2 — Registro inmutable de acciones sensibles del staff.
///
/// Propósito DGII / compliance fiscal RD:
///   - Cada orden, pago, descuento, cancelación queda trazada al userId
///   - El campo AuthMethod distingue acciones hechas vía login email/password
///     vs vía PIN en device compartido — crítico para auditoría cuando
///     un mismo device fue usado por múltiples waiters en un turno.
///
/// No se mutila: append-only. Para soft-delete de un AuditEvent usar Reason="REVERSED"
/// en un evento subsecuente que apunte al EntityId original.
/// </summary>
public class AuditEvent : BaseEntity
{
    /// <summary>
    /// ID del usuario que ejecutó la acción (extraído del JWT sub claim).
    /// AUDIT-FIX.1: Nullable para soportar acciones de cliente final anónimo (orden vía QR sin JWT).
    /// Antes era NOT NULL — provocaba FK violation silenciosa al intentar insertar UserId=0
    /// para clientes sin JWT, dropeando todos los Order.Created del cliente final del audit log.
    /// </summary>
    public int? UserId { get; set; }

    /// <summary>Identificador semántico de la acción. Ej: "Order.Created", "Payment.Processed".</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>Tipo de entidad afectada (ej. "Order", "Payment", "TableReservation").</summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>ID de la entidad afectada. Null si la acción no tiene entidad (ej. login).</summary>
    public int? EntityId { get; set; }

    /// <summary>IP origen (de RemoteIpAddress). Útil para forense cuando hay devices compartidos.</summary>
    public string? IpAddress { get; set; }

    /// <summary>"password" | "pin" — extraído del JWT claim auth_method. Crítico para distinguir.</summary>
    public string AuthMethod { get; set; } = "password";

    /// <summary>JSON serializado con context adicional (ej. monto, dishes, etc.). Limitado a 2KB.</summary>
    public string? Metadata { get; set; }

    /// <summary>Cuándo ocurrió (UTC, mismo que CreatedAt pero explícito por claridad).</summary>
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    // Navigation property — opcional, no se carga eagerly normalmente
    public User? User { get; set; }
}
