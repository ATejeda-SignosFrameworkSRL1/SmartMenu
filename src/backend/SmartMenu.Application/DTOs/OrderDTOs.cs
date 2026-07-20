using System.ComponentModel.DataAnnotations;
using SmartMenu.Domain.Enums;

namespace SmartMenu.Application.DTOs;

// Request DTOs
public record CreateOrderDto
{
    /// <summary>Null para órdenes de mostrador/para llevar (POS del cajero).</summary>
    public int? TableId { get; init; }

    [Required, StringLength(128, MinimumLength = 1)]
    public string SessionId { get; init; } = string.Empty;

    [StringLength(128)]
    public string? CustomerName { get; init; }

    [StringLength(1024)]
    public string? SpecialInstructions { get; init; }

    /// <summary>PARA LLEVAR desde la mesa: crea una orden SEPARADA (NO se fusiona con la orden
    /// viva de la mesa), para que su comanda traiga solo los ítems para llevar y tenga su
    /// propia cuenta. Solo controla el ruteo al crear; no se persiste como columna.</summary>
    public bool IsTakeaway { get; init; }

    [Required, MinLength(1)]
    public List<CreateOrderItemDto> Items { get; init; } = new();
}

public record CreateOrderItemDto
{
    [Range(1, int.MaxValue)]
    public int DishId { get; init; }

    [Range(1, 99)]
    public int Quantity { get; init; }

    /// <summary>⚠ Ignored by backend — server-side pricing usa Dish.Price del catálogo.</summary>
    public decimal UnitPrice { get; init; }

    [StringLength(512)]
    public string? Notes { get; init; }

    // Customer preferences
    public string? DrinkTiming { get; init; }
    public bool? WithAlcohol { get; init; }
    public string? MeatCooking { get; init; }
    public string? SideDish { get; init; }
    public string? Customizations { get; init; }
    public string? Allergies { get; init; }
    /// <summary>Curso en que servir el ítem (null = usar el DefaultCourse del plato)</summary>
    public CourseTiming? CourseTiming { get; init; }
}

public record UpdateOrderStatusDto
{
    [Required, StringLength(32, MinimumLength = 1)]
    public string NewStatus { get; init; } = string.Empty;

    /// <summary>
    /// P0.2 — Razón obligatoria cuando Admin/Manager fuerza Completed sin pago
    /// completo (override fiscal auditado). Para transiciones normales se ignora.
    /// </summary>
    [StringLength(512)]
    public string? OverrideReason { get; init; }
}

public record CancelOrderDto
{
    [StringLength(256)]
    public string? Reason { get; init; }
}

// Response DTOs
public record OrderDto
{
    public int Id { get; init; }
    public string OrderNumber { get; init; } = string.Empty;
    public int? TableId { get; init; }
    public string TableNumber { get; init; } = string.Empty;
    public bool IsPickup { get; init; }
    /// <summary>Modalidad de entrega: DineIn (mesa) | Pickup | Delivery. Derivada de la
    /// Invoice del portal si existe; si no, de IsPickup (mostrador). Para badges KDS/admin.</summary>
    public string FulfillmentType { get; init; } = "DineIn";
    public string? CustomerName { get; init; }
    public int? AssignedWaiterId { get; init; }
    public decimal Subtotal { get; init; }
    public decimal Tax { get; init; }
    public decimal Tip { get; init; }
    public decimal Total { get; init; }
    public string Status { get; init; } = string.Empty;
    public bool KitchenPreparing { get; init; }
    public bool KitchenReady { get; init; }
    public bool KitchenServed { get; init; }
    public bool BarPreparing { get; init; }
    public bool BarReady { get; init; }
    public bool BarServed { get; init; }
    public bool CustomerFinishedEating { get; init; }
    public string? SpecialInstructions { get; init; }
    public DateTime CreatedAt { get; init; }
    public List<OrderItemDto> Items { get; init; } = new();
    /// <summary>True si el mesero ya registró el cobro de esta orden (solo para órdenes Completed).</summary>
    public bool PaymentCollectedByWaiter { get; init; }
    /// <summary>Propina del pago (solo para órdenes Completed con pago creado por el cliente).</summary>
    public decimal PaymentTipAmount { get; init; }
    /// <summary>Método de pago solicitado por el cliente al pedir la cuenta.</summary>
    public string? ClientRequestedPaymentMethod { get; init; }
    /// <summary>Porcentaje de propina solicitado por el cliente.</summary>
    public decimal ClientTipPercentage { get; init; }
    /// <summary>Monto de propina solicitado por el cliente.</summary>
    public decimal ClientTipAmount { get; init; }
    /// <summary>El cliente solicita comprobante fiscal.</summary>
    public bool ClientRequiresFiscalReceipt { get; init; }
    /// <summary>RNC del cliente (si solicitó comprobante).</summary>
    public string? ClientRNC { get; init; }
    /// <summary>Nombre de la empresa validado.</summary>
    public string? ClientBusinessName { get; init; }
}

public record OrderItemDto
{
    public int Id { get; init; }
    public int DishId { get; init; }
    public string DishName { get; init; } = string.Empty;
    public string? CategoryName { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Subtotal { get; init; }
    public string? Notes { get; init; }
    /// <summary>Comensal que pidió este ítem (para mostrar en cocina/bar/mesero).</summary>
    public string? CustomerName { get; init; }
    public string? Customizations { get; init; }
    public string? Allergies { get; init; }
    public string? SideDish { get; init; }
    /// <summary>Preferencia (ej. término de carne) en texto.</summary>
    public string? PreferenceText { get; init; }
    public bool IsReady { get; init; }
    /// <summary>
    /// FASE 2 RUTEO — true si el item va al BAR, false si va a COCINA. Lo calcula el
    /// backend (Dish.KitchenZone.Type manda; keywords por nombre solo como fallback).
    /// Los frontends y el print-agent deben preferir este flag sobre su matcher local.
    /// </summary>
    public bool IsDrink { get; init; }
    public int? KitchenZoneId { get; init; }
    public string? KitchenZoneName { get; init; }
    /// <summary>Curso en que se debe servir este ítem (Entrada, PlatoFuerte, Postre)</summary>
    public string? CourseTiming { get; init; }
}
