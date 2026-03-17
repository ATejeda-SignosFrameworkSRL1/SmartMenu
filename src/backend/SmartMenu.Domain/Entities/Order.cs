using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Order : BaseEntity
{
    public string OrderNumber { get; set; } = string.Empty;
    /// <summary>Null cuando es una orden para llevar (POS del cajero).</summary>
    public int? TableId { get; set; }
    /// <summary>True para órdenes de mostrador/para llevar creadas por el cajero.</summary>
    public bool IsPickup { get; set; } = false;
    public int? TableSessionId { get; set; }
    public string SessionId { get; set; } = string.Empty;
    /// <summary>Nombre del comensal (lo ingresa al entrar al menú desde el QR).</summary>
    public string? CustomerName { get; set; }
    public int? CustomerId { get; set; }
    public int? AssignedWaiterId { get; set; } // Mesero que confirmó y atiende esta orden
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Tip { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    /// <summary>Cocina marcó "Preparando" para esta orden.</summary>
    public bool KitchenPreparing { get; set; }
    /// <summary>Bar marcó "Preparando" para esta orden.</summary>
    public bool BarPreparing { get; set; }
    /// <summary>Cocina marcó "Listo" para esta orden.</summary>
    public bool KitchenReady { get; set; }
    /// <summary>Bar marcó "Listo" para esta orden.</summary>
    public bool BarReady { get; set; }
    /// <summary>Mesero sirvió los platos de cocina.</summary>
    public bool KitchenServed { get; set; }
    /// <summary>Mesero sirvió las bebidas del bar.</summary>
    public bool BarServed { get; set; }
    public string? SpecialInstructions { get; set; }
    public int EstimatedTimeMinutes { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? ServedAt { get; set; }
    public bool CustomerFinishedEating { get; set; } = false; // Cliente terminó de comer
    public DateTime? FinishedEatingAt { get; set; }
    /// <summary>Método de pago solicitado por el cliente al pedir la cuenta.</summary>
    public string? ClientRequestedPaymentMethod { get; set; } // Cash, Card, Transfer, Mixed
    /// <summary>Porcentaje de propina solicitado por el cliente.</summary>
    public decimal ClientTipPercentage { get; set; } = 0;
    /// <summary>Monto de propina en valor absoluto solicitado por el cliente.</summary>
    public decimal ClientTipAmount { get; set; } = 0;
    /// <summary>El cliente solicita comprobante fiscal (NCF).</summary>
    public bool ClientRequiresFiscalReceipt { get; set; } = false;
    /// <summary>RNC de la empresa del cliente (si solicita comprobante).</summary>
    public string? ClientRNC { get; set; }
    /// <summary>Nombre de la empresa validado contra la DGII.</summary>
    public string? ClientBusinessName { get; set; }

    // Navigation properties
    public Table? Table { get; set; }
    public TableSession? TableSession { get; set; }
    public User? Customer { get; set; }
    public User? AssignedWaiter { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
