using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IReservationService
{

    Task<ReservationActionResult> CreateHoldAsync(HoldRequestDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> ConfirmPublicAsync(int id, ConfirmPublicDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> CreateStaffAsync(CreateReservationStaffDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> ConfirmAsync(int id, string? rowVersion, CancellationToken ct = default);

    Task<ReservationActionResult> AssignTableAsync(int id, AssignTableDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> AutoAssignAsync(int id, CancellationToken ct = default);

    Task<ReservationActionResult> SeatAsync(int id, SeatReservationDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> MarkNoShowAsync(int id, CancellationToken ct = default);

    Task<ReservationActionResult> CancelAsync(int id, CancelReservationDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> RescheduleAsync(int id, RescheduleReservationDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> CreateZoneRequestAsync(ZoneRequestDto dto, CancellationToken ct = default);

    Task<ReservationActionResult> RespondZoneAsync(int id, ZoneDecisionDto dto, CancellationToken ct = default);

    Task<ReservationTrackDto?> GetTrackAsync(string code, CancellationToken ct = default);
}
