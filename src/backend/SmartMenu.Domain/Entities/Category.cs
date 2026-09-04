namespace SmartMenu.Domain.Entities;

public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MenuId { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public Menu Menu { get; set; } = null!;
    public ICollection<Dish> Dishes { get; set; } = new List<Dish>();
}
