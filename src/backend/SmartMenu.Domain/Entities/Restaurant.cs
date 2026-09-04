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

    public WaiterAuthMode WaiterAuthMode { get; set; } = WaiterAuthMode.PrivateOnly;

    public string? FloorPlanPaletteJson { get; set; }

    public bool FloorPlanHostEnabled { get; set; } = true;

    public bool FloorPlanWaiterEnabled { get; set; } = true;

    public bool DeliveryTrackingEnabled { get; set; } = true;

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public ICollection<User> Staff { get; set; } = new List<User>();
    public ICollection<Table> Tables { get; set; } = new List<Table>();
    public ICollection<Menu> Menus { get; set; } = new List<Menu>();
    public ICollection<Zone> Zones { get; set; } = new List<Zone>();
}
