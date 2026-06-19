using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public UserRole Role { get; set; } = UserRole.Customer;
    public bool IsActive { get; set; } = true;
    public int? RestaurantId { get; set; }
    /// <summary>For Chef/Bartender: the Kitchen or Bar zone they belong to</summary>
    public int? AssignedZoneId { get; set; }

    // ── PIN del Waiter (Sprint 2 — modo PUBLIC compartido) ─────────────────
    /// <summary>BCrypt hash del PIN de 6 dígitos del waiter. Null si aún no se configuró.</summary>
    public string? PinHash { get; set; }
    /// <summary>Cuándo se estableció/cambió el PIN — útil para forzar rotación cada N días.</summary>
    public DateTime? PinSetAt { get; set; }
    /// <summary>Fallos consecutivos de PIN, reseteado en éxito.</summary>
    public int PinFailedAttempts { get; set; }
    /// <summary>Si != null, el PIN está bloqueado hasta esta hora (lockout corto, 5 min).</summary>
    public DateTime? PinLockedUntil { get; set; }

    // Navigation properties
    public Restaurant? Restaurant { get; set; }
    public Zone? AssignedZone { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
