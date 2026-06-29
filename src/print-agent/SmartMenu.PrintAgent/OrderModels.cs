namespace SmartMenu.PrintAgent;

/// <summary>Subconjunto del OrderDto del backend, solo lo que necesita la comanda.</summary>
public sealed class OrderDtoModel
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string TableNumber { get; set; } = string.Empty;
    public bool IsPickup { get; set; }
    public string? CustomerName { get; set; }
    public string? SpecialInstructions { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemModel> Items { get; set; } = new();
}

public sealed class OrderItemModel
{
    public int Id { get; set; }
    public string DishName { get; set; } = string.Empty;
    public string? CategoryName { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
    /// <summary>Comensal que pidio este item.</summary>
    public string? CustomerName { get; set; }
    public string? Allergies { get; set; }
    public string? SideDish { get; set; }
    /// <summary>Preferencia en texto (ej. termino de carne).</summary>
    public string? PreferenceText { get; set; }
    public string? KitchenZoneName { get; set; }
    public string? CourseTiming { get; set; }
}

/// <summary>Respuesta de POST /api/auth/login.</summary>
public sealed class LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;
}
