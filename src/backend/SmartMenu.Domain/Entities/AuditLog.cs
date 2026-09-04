namespace SmartMenu.Domain.Entities;

public class AuditLog
{
    public long Id { get; set; }

    public string EntityName { get; set; } = string.Empty;

    public string EntityId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string? ChangesJson { get; set; }

    public int? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? Endpoint { get; set; }
    public string? IpAddress { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
