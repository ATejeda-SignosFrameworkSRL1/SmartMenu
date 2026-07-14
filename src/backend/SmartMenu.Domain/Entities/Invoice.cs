using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

/// <summary>
/// Factura GLOBAL de un checkout multi-franquicia (agregador delivery/pickup online).
/// El cliente paga UNA sola Invoice; por dentro el sistema la parte en una <see cref="Order"/>
/// por franquicia (cada KDS procesa solo lo suyo).
///
/// La verdad FISCAL vive por Order (RNC propio por franquicia): esta Invoice solo SUMA los
/// totales para el cobro único del cliente. NO depende de mesa/TableSession (es online).
/// </summary>
public class Invoice : BaseEntity
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int? CustomerId { get; set; }

    public FulfillmentType FulfillmentType { get; set; } = FulfillmentType.Delivery;
    /// <summary>Obligatoria cuando FulfillmentType = Delivery.</summary>
    public string? DeliveryAddress { get; set; }
    public string? Notes { get; set; }

    // Totales = SUMA de las Orders (envoltorio de cobro; la verdad fiscal es por Order).
    public decimal SubTotal { get; set; }
    public decimal TaxITBIS { get; set; }
    public decimal LegalTip { get; set; }
    public decimal Total { get; set; }

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public DeliveryStatus DeliveryStatus { get; set; } = DeliveryStatus.Pending;

    // Navigation
    public User? Customer { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
