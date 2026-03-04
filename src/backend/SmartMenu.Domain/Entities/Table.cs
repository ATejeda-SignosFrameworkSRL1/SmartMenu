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
    
    // Navigation properties
    public Zone Zone { get; set; } = null!;
    public Restaurant Restaurant { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
