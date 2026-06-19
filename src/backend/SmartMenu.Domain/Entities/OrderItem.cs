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
    /// <summary>Nombre del comensal que pidió ESTE ítem. Varios comensales de una misma mesa
    /// (mismo QR) comparten una sola Order; cada ítem lleva el nombre de quién lo pidió.</summary>
    public string? CustomerName { get; set; }
    public string? Destination { get; set; } // "Kitchen" or "Bar"
    public bool IsReady { get; set; } = false;
    
    // Customer Preferences
    public DrinkTiming? DrinkTiming { get; set; } // When to serve the drink
    public bool? WithAlcohol { get; set; } // For drinks with alcohol option
    public MeatCooking? MeatCooking { get; set; } // Level of meat cooking
    public string? SideDish { get; set; } // Selected side dish/garnish
    public string? Customizations { get; set; } // "Sin cebolla", "Extra queso", etc.
    public string? Allergies { get; set; } // Customer allergies for this item
    /// <summary>Preferencia en texto (ej. "Término 3/4") enviada por el cliente.</summary>
    public string? PreferenceText { get; set; }
    /// <summary>Curso en que se debe servir este ítem (heredado del plato o sobreescrito por el cliente).</summary>
    public CourseTiming? CourseTiming { get; set; }
    
    // Navigation properties
    public Order Order { get; set; } = null!;
    public Dish Dish { get; set; } = null!;
}
