using System.ComponentModel.DataAnnotations;
using SmartMenu.Domain.Enums;

namespace SmartMenu.Application.DTOs;

public record CreateOrderDto
{

    public int? TableId { get; init; }

    [Required, StringLength(128, MinimumLength = 1)]
    public string SessionId { get; init; } = string.Empty;

    [StringLength(128)]
    public string? CustomerName { get; init; }

    [StringLength(1024)]
    public string? SpecialInstructions { get; init; }

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

    public decimal UnitPrice { get; init; }

    [StringLength(512)]
    public string? Notes { get; init; }

    public string? DrinkTiming { get; init; }
    public bool? WithAlcohol { get; init; }
    public string? MeatCooking { get; init; }
    public string? SideDish { get; init; }
    public string? Customizations { get; init; }
    public string? Allergies { get; init; }

    public CourseTiming? CourseTiming { get; init; }
}

public record UpdateOrderStatusDto
{
    [Required, StringLength(32, MinimumLength = 1)]
    public string NewStatus { get; init; } = string.Empty;

    [StringLength(512)]
    public string? OverrideReason { get; init; }
}

public record CancelOrderDto
{
    [StringLength(256)]
    public string? Reason { get; init; }
}

public record OrderDto
{
    public int Id { get; init; }
    public string OrderNumber { get; init; } = string.Empty;
    public int? TableId { get; init; }
    public string TableNumber { get; init; } = string.Empty;
    public bool IsPickup { get; init; }

    public bool IsTakeaway { get; init; }

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

    public bool PaymentCollectedByWaiter { get; init; }

    public decimal PaymentTipAmount { get; init; }

    public string? ClientRequestedPaymentMethod { get; init; }

    public decimal ClientTipPercentage { get; init; }

    public decimal ClientTipAmount { get; init; }

    public bool ClientRequiresFiscalReceipt { get; init; }

    public string? ClientRNC { get; init; }

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

    public string? CustomerName { get; init; }
    public string? Customizations { get; init; }
    public string? Allergies { get; init; }
    public string? SideDish { get; init; }

    public string? PreferenceText { get; init; }
    public bool IsReady { get; init; }

    public bool IsDrink { get; init; }
    public int? KitchenZoneId { get; init; }
    public string? KitchenZoneName { get; init; }

    public string? CourseTiming { get; init; }
}
