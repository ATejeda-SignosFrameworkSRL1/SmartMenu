namespace SmartMenu.Domain.Enums;

public enum DeliveryStatus
{
    Pending = 0,
    Confirmed = 1,
    Preparing = 2,
    ReadyForPickup = 3,
    OutForDelivery = 4,
    Delivered = 5,
    Cancelled = 6
}
