namespace SmartMenu.Domain.Entities;

public class ServicePeriod : BaseEntity
{
    public int RestaurantId { get; set; }

    public string Name { get; set; } = string.Empty;

    public int DaysOfWeekMask { get; set; } = 127;

    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    public int SlotMinutes { get; set; } = 30;

    public int DefaultDurationMinutes { get; set; } = 90;

    public int TurnoverBufferMinutes { get; set; } = 10;

    public int MaxCoversPerSlot { get; set; } = 0;

    public int MaxReservationsPerSlot { get; set; } = 0;

    public int LeadTimeMinutes { get; set; } = 30;

    public int MaxHorizonDays { get; set; } = 60;

    public bool IsActive { get; set; } = true;

    public int? LargePartyThreshold { get; set; }
    public int? LargePartyDurationMinutes { get; set; }

    public Restaurant? Restaurant { get; set; }
}
