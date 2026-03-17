using SmartMenu.Domain.Enums;

namespace SmartMenu.Application.DTOs;

public record DishDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public bool IsAvailable { get; init; }
    public bool IsVegetarian { get; init; }
    public bool IsVegan { get; init; }
    public bool IsGlutenFree { get; init; }
    public int PreparationTimeMinutes { get; init; }
    public int? KitchenZoneId { get; init; }
    public string? KitchenZoneName { get; init; }
    public CourseTiming DefaultCourse { get; init; } = CourseTiming.PlatoFuerte;
    public List<DishTagDto> Tags { get; init; } = new();
    public List<DishImageDto> Images { get; init; } = new();
}

public record DishImageDto
{
    public int Id { get; init; }
    public string ImageUrl { get; init; } = string.Empty;
    public int DisplayOrder { get; init; }
    public bool IsMain { get; init; }
}

public record DishTagDto
{
    public int Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Icon { get; init; } = string.Empty;
}

public record CategoryDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int SortOrder { get; init; }
    public List<DishDto> Dishes { get; init; } = new();
}

public record CreateDishDto
{
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int CategoryId { get; init; }
    public string? ImageUrl { get; init; }
    public bool IsVegetarian { get; init; }
    public bool IsVegan { get; init; }
    public bool IsGlutenFree { get; init; }
    public int PreparationTimeMinutes { get; init; }
    public int? KitchenZoneId { get; init; }
    public CourseTiming DefaultCourse { get; init; } = CourseTiming.PlatoFuerte;
    public List<int> TagIds { get; init; } = new();
}
