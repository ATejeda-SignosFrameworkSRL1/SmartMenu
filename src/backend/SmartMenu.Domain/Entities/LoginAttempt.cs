namespace SmartMenu.Domain.Entities;

public class LoginAttempt : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public bool Success { get; set; }
    public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
}
