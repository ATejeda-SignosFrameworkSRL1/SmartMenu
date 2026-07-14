namespace SmartMenu.Application.DTOs;

/// <summary>Carrito mixto que envía el frontend del agregador online. El servidor DERIVA la
/// franquicia (RestaurantId) y el precio de cada plato — nunca se confían del cliente.</summary>
public class CreateInvoiceDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int? CustomerId { get; set; }

    /// <summary>"Delivery" | "Pickup". Default Delivery.</summary>
    public string FulfillmentType { get; set; } = "Delivery";
    /// <summary>Obligatoria cuando FulfillmentType = Delivery.</summary>
    public string? DeliveryAddress { get; set; }
    public string? Notes { get; set; }

    // Fiscal opcional — se propaga a CADA Order de franquicia (RNC propio por franquicia).
    public bool RequiresFiscalReceipt { get; set; } = false;
    public string? RNC { get; set; }
    public string? BusinessName { get; set; }

    public List<CreateInvoiceItemDto> Items { get; set; } = new();
}

public class CreateInvoiceItemDto
{
    public int DishId { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
    public string? Customizations { get; set; }
    public string? Allergies { get; set; }
}

public class UpdateDeliveryStatusDto
{
    /// <summary>Nombre del DeliveryStatus: Pending|Confirmed|Preparing|ReadyForPickup|OutForDelivery|Delivered|Cancelled.</summary>
    public string Status { get; set; } = string.Empty;
}

// ── Respuesta ──
public class InvoiceDto
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public string FulfillmentType { get; set; } = "Delivery";
    public string? DeliveryAddress { get; set; }
    public string? Notes { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxITBIS { get; set; }
    public decimal LegalTip { get; set; }
    public decimal Total { get; set; }
    public string PaymentStatus { get; set; } = "Pending";
    public string DeliveryStatus { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
    /// <summary>Una Order por franquicia (así el KDS de cada una ve solo lo suyo).</summary>
    public List<InvoiceOrderDto> Orders { get; set; } = new();
}

public class InvoiceOrderDto
{
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public int? RestaurantId { get; set; }
    public string? RestaurantName { get; set; }
    public string Status { get; set; } = "Pending";
    public bool KitchenReady { get; set; }
    public bool BarReady { get; set; }
    // Verdad fiscal por franquicia.
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Tip { get; set; }
    public decimal Total { get; set; }
    public List<InvoiceOrderItemDto> Items { get; set; } = new();
}

public class InvoiceOrderItemDto
{
    public int DishId { get; set; }
    public string DishName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Subtotal { get; set; }
}
