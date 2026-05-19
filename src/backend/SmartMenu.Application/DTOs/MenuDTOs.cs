using System.ComponentModel.DataAnnotations;
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
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [StringLength(150, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 150 caracteres.")]
    public string Name { get; init; } = string.Empty;

    [Required(ErrorMessage = "La descripción es obligatoria.")]
    [StringLength(500, MinimumLength = 3, ErrorMessage = "La descripción debe tener entre 3 y 500 caracteres.")]
    public string Description { get; init; } = string.Empty;

    [Range(0.01, 100000, ErrorMessage = "El precio debe ser mayor que 0 y menor que 100,000.")]
    public decimal Price { get; init; }

    [Range(1, int.MaxValue, ErrorMessage = "Debe seleccionar una categoría válida.")]
    public int CategoryId { get; init; }

    [StringLength(500)]
    public string? ImageUrl { get; init; }

    public bool IsVegetarian { get; init; }
    public bool IsVegan { get; init; }
    public bool IsGlutenFree { get; init; }

    [Range(0, 240, ErrorMessage = "El tiempo de preparación debe estar entre 0 y 240 minutos.")]
    public int PreparationTimeMinutes { get; init; }

    public int? KitchenZoneId { get; init; }
    public CourseTiming DefaultCourse { get; init; } = CourseTiming.PlatoFuerte;
    public List<int> TagIds { get; init; } = new();
}
