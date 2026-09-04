namespace SmartMenu.Domain.Entities;

public class Zone : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = "Dining";
    public string? Description { get; set; }
    public int RestaurantId { get; set; }
    public bool IsActive { get; set; } = true;

    public Restaurant Restaurant { get; set; } = null!;
    public ICollection<Table> Tables { get; set; } = new List<Table>();
}
