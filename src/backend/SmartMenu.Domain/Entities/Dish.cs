using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Dish : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int CategoryId { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsAvailable { get; set; } = true;
    public bool IsVegetarian { get; set; } = false;
    public bool IsVegan { get; set; } = false;
    public bool IsGlutenFree { get; set; } = false;
    public int PreparationTimeMinutes { get; set; }

    public int? KitchenZoneId { get; set; }

    public CourseTiming DefaultCourse { get; set; } = CourseTiming.PlatoFuerte;

    public bool IsDeleted { get; set; } = false;

    public DateTime? DeletedAt { get; set; }

    public Category Category { get; set; } = null!;
    public Zone? KitchenZone { get; set; }
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public ICollection<DishDishTag> DishTags { get; set; } = new List<DishDishTag>();
    public ICollection<DishImage> Images { get; set; } = new List<DishImage>();
}
