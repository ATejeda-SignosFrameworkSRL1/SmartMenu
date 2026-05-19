namespace SmartMenu.Domain.Entities;

/// <summary>
/// Token de refresco para renovar JWTs sin re-pedir password.
/// Se guarda HASHED (SHA-256) — el valor plano nunca persiste.
/// Rotación obligatoria: cada uso invalida el actual y emite uno nuevo.
/// </summary>
public class RefreshToken : BaseEntity
{
    public int UserId { get; set; }

    /// <summary>SHA-256 hex del token plano. Indexed.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    /// <summary>Set cuando el token se usa (rotación) o se revoca manualmente.</summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>SHA-256 del token que reemplazó a este (cadena de rotación, para detectar replay).</summary>
    public string? ReplacedByTokenHash { get; set; }

    /// <summary>Opcional: IP origen al emitir, para auditoría/forense.</summary>
    public string? CreatedByIp { get; set; }

    public User? User { get; set; }

    public bool IsActive => RevokedAt is null && DateTime.UtcNow < ExpiresAt;
}
