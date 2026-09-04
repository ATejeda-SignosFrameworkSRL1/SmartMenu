namespace SmartMenu.Application.DTOs;

public record SlotDto(string Time, string Status, int Remaining, bool IsPast);

public record ServiceWindowDto(string Label, string Start, string End);

public class AvailabilityResultDto
{
    public string Date { get; set; } = string.Empty;
    public int Guests { get; set; }
    public int? ZoneId { get; set; }
    public int SlotMinutes { get; set; }
    public List<ServiceWindowDto> ServiceWindows { get; set; } = new();
    public List<SlotDto> Slots { get; set; } = new();
}

public record SlotFeasibility(bool Bookable, int RemainingCovers);

public record OccupancyBlockDto(
    string Time,
    int Covers,
    int MaxCovers,
    int Reservations,
    int MaxReservations,
    string Status);

public class OccupancyResultDto
{
    public string Date { get; set; } = string.Empty;
    public int SlotMinutes { get; set; }
    public List<ServiceWindowDto> ServiceWindows { get; set; } = new();
    public List<OccupancyBlockDto> Blocks { get; set; } = new();
}

public class TableAvailabilityDto
{
    public int TableId { get; set; }
    public int TableNumber { get; set; }
    public string ZoneName { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public List<string> FreeSlots { get; set; } = new();
}

public class TableAvailabilityResultDto
{
    public string Date { get; set; } = string.Empty;
    public int SlotMinutes { get; set; }
    public List<TableAvailabilityDto> Tables { get; set; } = new();
}

public class HoldRequestDto
{
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public int Guests { get; set; }
    public int? ZoneId { get; set; }
}

public class ConfirmPublicDto
{
    public string ConfirmationCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int OccasionType { get; set; }
    public string? SpecialRequests { get; set; }
}

public class CreateReservationStaffDto
{
    public string? Date { get; set; }
    public string? Time { get; set; }
    public DateTime? ReservationDateTime { get; set; }
    public int NumberOfGuests { get; set; }
    public int? ZoneId { get; set; }
    public int? TableId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int OccasionType { get; set; }
    public string? SpecialRequests { get; set; }
    public int? HostId { get; set; }
}

public class AssignTableDto
{
    public int? TableId { get; set; }
    public List<int>? TableIds { get; set; }
    public string? RowVersion { get; set; }
}

public class SeatReservationDto
{
    public int? TableId { get; set; }
    public int? WaiterId { get; set; }
    public int? HostId { get; set; }
    public int? NumberOfGuests { get; set; }
}

public class CancelReservationDto
{
    public string? Reason { get; set; }
    public string? ConfirmationCode { get; set; }
    public string? RowVersion { get; set; }
}

public class RescheduleReservationDto
{
    public DateTime NewDateTime { get; set; }
    public string? RowVersion { get; set; }
}

public class ZoneRequestDto
{
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public int Guests { get; set; }
    public int ZoneId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int OccasionType { get; set; }
    public string? SpecialRequests { get; set; }
}

public class ZoneDecisionDto
{
    public bool Accept { get; set; }
    public string? Message { get; set; }
}

public class ReservationTrackDto
{
    public string Status { get; set; } = string.Empty;
    public bool IsZoneExclusive { get; set; }
    public string? ZoneName { get; set; }
    public string ReservationDateTime { get; set; } = string.Empty;
    public int NumberOfGuests { get; set; }
    public int OccasionType { get; set; }
    public string? HostResponseMessage { get; set; }
    public int AssignedTableCount { get; set; }
    public string CustomerName { get; set; } = string.Empty;
}

public class ReservationActionResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? Code { get; set; }
    public int? ReservationId { get; set; }
    public string? ConfirmationCode { get; set; }
    public string? Status { get; set; }
    public DateTime? HoldExpiresAt { get; set; }
    public string? ReservationDateTime { get; set; }
    public List<int>? AssignedTableIds { get; set; }
    public int? TableSessionId { get; set; }

    public static ReservationActionResult Fail(string error, string code) =>
        new() { Success = false, Error = error, Code = code };
}
