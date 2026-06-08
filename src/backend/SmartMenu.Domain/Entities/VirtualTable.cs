namespace SmartMenu.Domain.Entities;

/// <summary>
/// Mesa virtual: agrupa varias mesas físicas (ej. cuando juntan mesas).
/// Los pedidos de cada mesa física se reflejan en la vista de la mesa virtual.
/// </summary>
public class VirtualTable : BaseEntity
{
    public string Name { get; set; } = string.Empty; // ej. "Mesa Virtual 1"
    public int CreatedByWaiterId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? DeactivatedAt { get; set; }
    /// <summary>Mesa designada para el pago general (cobro unificado de la mesa virtual). Null = sin pagadora.</summary>
    public int? PayerTableId { get; set; }

    public User CreatedByWaiter { get; set; } = null!;
    public ICollection<VirtualTableTable> Tables { get; set; } = new List<VirtualTableTable>();
}
