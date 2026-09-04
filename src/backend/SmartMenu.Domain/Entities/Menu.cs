namespace SmartMenu.Domain.Entities;

public class Menu : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int RestaurantId { get; set; }
    public bool IsActive { get; set; } = true;

    public Restaurant Restaurant { get; set; } = null!;
    public ICollection<Category> Categories { get; set; } = new List<Category>();
}
