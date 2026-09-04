using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Table : BaseEntity
{
    public int TableNumber { get; set; }
    public int Capacity { get; set; }
    public int ZoneId { get; set; }
    public int RestaurantId { get; set; }
    public TableStatus Status { get; set; } = TableStatus.Available;
    public string QRCode { get; set; } = string.Empty;

    public double? PositionX { get; set; }

    public double? PositionY { get; set; }

    public string? Shape { get; set; }

    public double? Width { get; set; }

    public double? Height { get; set; }

    public string? Server { get; set; }

    public string? Name { get; set; }

    public string? Color { get; set; }

    public Zone Zone { get; set; } = null!;
    public Restaurant Restaurant { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
