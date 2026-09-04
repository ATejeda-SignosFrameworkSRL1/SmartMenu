using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Payment : BaseEntity
{
    public int OrderId { get; set; }
    public decimal Amount { get; set; }
    public decimal TipAmount { get; set; } = 0;
    public decimal TipPercentage { get; set; } = 0;
    public decimal TotalAmount { get; set; }
    public string Method { get; set; } = string.Empty;
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? TransactionId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? ProcessedByWaiterId { get; set; }

    public string? BillSplitType { get; set; }

    public int? SplitPartIndex { get; set; }

    public bool RequiresFiscalReceipt { get; set; } = false;

    public string? RNC { get; set; }

    public string? BusinessName { get; set; }

    [System.ComponentModel.DataAnnotations.Timestamp]
    public byte[]? RowVersion { get; set; }

    public Order Order { get; set; } = null!;
    public User? ProcessedByWaiter { get; set; }
}
