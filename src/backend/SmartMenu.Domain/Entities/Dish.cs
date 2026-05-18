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
    /// <summary>Kitchen or Bar zone where this dish is prepared (null = default/main kitchen)</summary>
    public int? KitchenZoneId { get; set; }
    /// <summary>Default course/timing for this dish (Entrada, PlatoFuerte, Postre)</summary>
    public CourseTiming DefaultCourse { get; set; } = CourseTiming.PlatoFuerte;

    /// <summary>Soft delete flag. DGII exige conservar histórico de productos vendidos.</summary>
    public bool IsDeleted { get; set; } = false;

    /// <summary>Fecha en que el plato fue marcado como eliminado.</summary>
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public Category Category { get; set; } = null!;
    public Zone? KitchenZone { get; set; }
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public ICollection<DishDishTag> DishTags { get; set; } = new List<DishDishTag>();
    public ICollection<DishImage> Images { get; set; } = new List<DishImage>();
}
