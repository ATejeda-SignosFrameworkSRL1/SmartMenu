namespace SmartMenu.Application.Settings;

public class ReservationSettings
{
    public const string SectionName = "Reservations";

    public int NoShowGraceMinutes { get; set; } = 15;

    public int DefaultDurationMinutes { get; set; } = 90;

    public int TurnoverBufferMinutes { get; set; } = 10;

    public int CancellationWindowMinutes { get; set; } = 120;

    public int HoldTtlMinutes { get; set; } = 10;

    public int SweepIntervalSeconds { get; set; } = 90;

    public int[] ReminderOffsetsMinutes { get; set; } = new[] { 1440, 120 };

    public int LimitedThreshold { get; set; } = 4;

    public bool RequireDeposit { get; set; } = false;
}
