namespace SmartMenu.Domain.Entities;

public class VirtualTable : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public int CreatedByWaiterId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? DeactivatedAt { get; set; }

    public int? PayerTableId { get; set; }

    public User CreatedByWaiter { get; set; } = null!;
    public ICollection<VirtualTableTable> Tables { get; set; } = new List<VirtualTableTable>();
}
