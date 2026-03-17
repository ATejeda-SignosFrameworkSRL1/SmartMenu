namespace SmartMenu.Domain.Entities;

public class WaiterShift : BaseEntity
{
    public int WaiterId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    
    // Navigation
    public User Waiter { get; set; } = null!;
}
