namespace SmartMenu.Domain.Entities;

public class DishImage : BaseEntity
{
    public int DishId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; } = 0;
    public bool IsMain { get; set; } = false;
    
    // Navigation
    public Dish Dish { get; set; } = null!;
}
