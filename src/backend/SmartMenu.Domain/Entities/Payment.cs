using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Payment : BaseEntity
{
    public int OrderId { get; set; }
    public decimal Amount { get; set; }
    public decimal TipAmount { get; set; } = 0; // Propina
    public decimal TipPercentage { get; set; } = 0; // Porcentaje de propina aplicado
    public decimal TotalAmount { get; set; } // Amount + TipAmount
    public string Method { get; set; } = string.Empty; // "Cash", "Card", "Transfer"
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? TransactionId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? ProcessedByWaiterId { get; set; } // Mesero que procesó el pago
    /// <summary>Tipo de división cuando es parte de una cuenta dividida.</summary>
    public string? BillSplitType { get; set; } // None, ByTime, ByComensal, Proportional, ByCategory
    /// <summary>Índice de la parte (1-based) cuando hay división.</summary>
    public int? SplitPartIndex { get; set; }
    /// <summary>Si el cliente solicita comprobante fiscal (NCF).</summary>
    public bool RequiresFiscalReceipt { get; set; } = false;
    /// <summary>RNC de la empresa (solo si RequiresFiscalReceipt).</summary>
    public string? RNC { get; set; }
    /// <summary>Nombre de la empresa obtenido con el RNC.</summary>
    public string? BusinessName { get; set; }

    /// <summary>Optimistic concurrency token (SQL Server rowversion).</summary>
    [System.ComponentModel.DataAnnotations.Timestamp]
    public byte[]? RowVersion { get; set; }

    // Navigation properties
    public Order Order { get; set; } = null!;
    public User? ProcessedByWaiter { get; set; }
}
