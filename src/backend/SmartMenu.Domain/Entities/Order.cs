using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Order : BaseEntity
{
    public string OrderNumber { get; set; } = string.Empty;

    public int? TableId { get; set; }

    public bool IsPickup { get; set; } = false;

    public bool IsTakeaway { get; set; } = false;
    public int? TableSessionId { get; set; }

    public int? InvoiceId { get; set; }

    public int? RestaurantId { get; set; }
    public string SessionId { get; set; } = string.Empty;

    public string? CustomerName { get; set; }
    public int? CustomerId { get; set; }
    public int? AssignedWaiterId { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Tip { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public bool KitchenPreparing { get; set; }

    public bool BarPreparing { get; set; }

    public bool KitchenReady { get; set; }

    public bool BarReady { get; set; }

    public bool KitchenServed { get; set; }

    public bool BarServed { get; set; }
    public string? SpecialInstructions { get; set; }
    public int EstimatedTimeMinutes { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? ServedAt { get; set; }
    public bool CustomerFinishedEating { get; set; } = false;
    public DateTime? FinishedEatingAt { get; set; }

    public string? ClientRequestedPaymentMethod { get; set; }

    public decimal ClientTipPercentage { get; set; } = 0;

    public decimal ClientTipAmount { get; set; } = 0;

    public bool ClientRequiresFiscalReceipt { get; set; } = false;

    public string? ClientRNC { get; set; }

    public string? ClientBusinessName { get; set; }

    [System.ComponentModel.DataAnnotations.Timestamp]
    public byte[]? RowVersion { get; set; }

    public Table? Table { get; set; }
    public TableSession? TableSession { get; set; }
    public Invoice? Invoice { get; set; }
    public Restaurant? Restaurant { get; set; }
    public User? Customer { get; set; }
    public User? AssignedWaiter { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
