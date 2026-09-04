using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Invoice : BaseEntity
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int? CustomerId { get; set; }

    public FulfillmentType FulfillmentType { get; set; } = FulfillmentType.Delivery;

    public string? DeliveryAddress { get; set; }
    public string? Notes { get; set; }

    public decimal SubTotal { get; set; }
    public decimal TaxITBIS { get; set; }
    public decimal LegalTip { get; set; }
    public decimal Total { get; set; }

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public DeliveryStatus DeliveryStatus { get; set; } = DeliveryStatus.Pending;

    public double? DriverLat { get; set; }
    public double? DriverLng { get; set; }
    public DateTime? DriverLocationAt { get; set; }

    public User? Customer { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
