namespace SmartMenu.Domain.Entities;

/// <summary>
/// S4.1 — Registro inmutable de cambios sensibles (precios, usuarios, pagos, órdenes).
/// Vive en DB separada (DbNewMenuAudit) para que cumplimiento/DGII pueda auditar
/// independientemente. NUNCA se actualiza ni borra — solo se inserta.
/// </summary>
public class AuditLog
{
    public long Id { get; set; }

    /// <summary>Nombre de la entidad afectada (Dish, User, Payment, Order, etc.).</summary>
    public string EntityName { get; set; } = string.Empty;

    /// <summary>PK de la entidad (int → string para flexibilidad futura con guids).</summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>Added | Modified | Deleted.</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>JSON con los cambios: { property: { old, new } } para Modified, snapshot completo para Added/Deleted.</summary>
    public string? ChangesJson { get; set; }

    public int? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? Endpoint { get; set; }
    public string? IpAddress { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
