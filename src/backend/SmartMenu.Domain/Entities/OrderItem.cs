using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class OrderItem : BaseEntity
{
    public int OrderId { get; set; }
    public int DishId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Subtotal { get; set; }
    public string? Notes { get; set; }

    public string? CustomerName { get; set; }
    public string? Destination { get; set; }
    public bool IsReady { get; set; } = false;

    public DrinkTiming? DrinkTiming { get; set; }
    public bool? WithAlcohol { get; set; }
    public MeatCooking? MeatCooking { get; set; }
    public string? SideDish { get; set; }
    public string? Customizations { get; set; }
    public string? Allergies { get; set; }

    public string? PreferenceText { get; set; }

    public CourseTiming? CourseTiming { get; set; }

    public Order Order { get; set; } = null!;
    public Dish Dish { get; set; } = null!;
}
