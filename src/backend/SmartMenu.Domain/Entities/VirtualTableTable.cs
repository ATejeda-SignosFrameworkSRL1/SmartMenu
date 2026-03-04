namespace SmartMenu.Domain.Entities;

/// <summary>
/// Relación mesa virtual - mesa física.
/// </summary>
public class VirtualTableTable
{
    public int VirtualTableId { get; set; }
    public int TableId { get; set; }

    public VirtualTable VirtualTable { get; set; } = null!;
    public Table Table { get; set; } = null!;
}
