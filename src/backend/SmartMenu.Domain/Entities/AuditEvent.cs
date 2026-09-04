namespace SmartMenu.Domain.Entities;

public class AuditEvent : BaseEntity
{

    public int? UserId { get; set; }

    public string Action { get; set; } = string.Empty;

    public string EntityType { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    public string? IpAddress { get; set; }

    public string AuthMethod { get; set; } = "password";

    public string? Metadata { get; set; }

    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
