namespace SmartMenu.Domain.Entities;

public class TableSession : BaseEntity
{
    public int TableId { get; set; }
    public int NumberOfGuests { get; set; }
    public int? AssignedWaiterId { get; set; } // Mesero asignado
    public int? AssignedByHostId { get; set; } // Host que asignó la mesa
    public DateTime StartTime { get; set; } = DateTime.UtcNow;
    public DateTime? EndTime { get; set; }
    public bool IsActive { get; set; } = true;
    public string? SpecialNotes { get; set; }
    
    // Navigation properties
    public Table Table { get; set; } = null!;
    public User? AssignedWaiter { get; set; }
    public User? AssignedByHost { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
