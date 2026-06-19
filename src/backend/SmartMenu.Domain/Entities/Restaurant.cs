using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Restaurant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? RNC { get; set; }
    public string? Logo { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Modo de autenticación del waiter-app:
    /// PrivateOnly (login JWT por device) | PublicPin (PIN en device compartido) | Hybrid (ambos).
    /// Decidido por el dueño/admin del restaurante.
    /// </summary>
    public WaiterAuthMode WaiterAuthMode { get; set; } = WaiterAuthMode.PrivateOnly;

    /// <summary>Paleta de colores de estado del plano (JSON, ej. {"occupied":"#..","reserved":"#.."}). Null = defaults del front.</summary>
    public string? FloorPlanPaletteJson { get; set; }

    // Navigation properties
    public ICollection<User> Staff { get; set; } = new List<User>();
    public ICollection<Table> Tables { get; set; } = new List<Table>();
    public ICollection<Menu> Menus { get; set; } = new List<Menu>();
    public ICollection<Zone> Zones { get; set; } = new List<Zone>();
}
