namespace SmartMenu.Domain.Entities;

public class ReservationPreOrder : BaseEntity
{
    public int ReservationId { get; set; }
    public string? Notes { get; set; }
    
    // Navigation
    public TableReservation Reservation { get; set; } = null!;
    public ICollection<PreOrderItem> Items { get; set; } = new List<PreOrderItem>();
}

public class PreOrderItem : BaseEntity
{
    public int PreOrderId { get; set; }
    public int DishId { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
    
    // Navigation
    public ReservationPreOrder PreOrder { get; set; } = null!;
    public Dish Dish { get; set; } = null!;
}
