namespace SmartMenu.Domain.Entities;

/// <summary>
/// Registro de cada intento de login (exitoso o no) para bloqueo defensivo
/// tras N fallos consecutivos en una ventana de tiempo (S4.3).
/// </summary>
public class LoginAttempt : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public bool Success { get; set; }
    public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
}
