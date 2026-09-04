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

    public int? AssignedZoneId { get; set; }

    public string? PinHash { get; set; }

    public DateTime? PinSetAt { get; set; }

    public int PinFailedAttempts { get; set; }

    public DateTime? PinLockedUntil { get; set; }

    public Restaurant? Restaurant { get; set; }
    public Zone? AssignedZone { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
