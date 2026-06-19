using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

/// <summary>
/// Operaciones transaccionales de reservas (capacidad dinámica por intervalo).
/// Toda creación/movimiento valida disponibilidad DENTRO de una sección crítica
/// (sp_getapplock + transacción) para que el overbooking sea estructuralmente imposible,
/// y mantiene sincronizados los bool legacy IsConfirmed/IsCancelled con Status.
/// </summary>
public interface IReservationService
{
    /// <summary>Portal público: crea un hold (reserva Pending con HoldExpiresAt). Atómico.</summary>
    Task<ReservationActionResult> CreateHoldAsync(HoldRequestDto dto, CancellationToken ct = default);

    /// <summary>Portal público: confirma un hold (Pending→Confirmed) usando el confirmationCode.</summary>
    Task<ReservationActionResult> ConfirmPublicAsync(int id, ConfirmPublicDto dto, CancellationToken ct = default);

    /// <summary>Staff: crea una reserva directa (queda Confirmed). Atómico.</summary>
    Task<ReservationActionResult> CreateStaffAsync(CreateReservationStaffDto dto, CancellationToken ct = default);

    /// <summary>Staff: confirma una reserva pendiente.</summary>
    Task<ReservationActionResult> ConfirmAsync(int id, string? rowVersion, CancellationToken ct = default);

    /// <summary>Staff: asigna una mesa (o combinación) con re-chequeo de solape + concurrencia.</summary>
    Task<ReservationActionResult> AssignTableAsync(int id, AssignTableDto dto, CancellationToken ct = default);

    /// <summary>Staff: auto-asigna la mesa de menor capacidad que sirva, libre en la ventana.</summary>
    Task<ReservationActionResult> AutoAssignAsync(int id, CancellationToken ct = default);

    /// <summary>Staff: sienta al cliente — crea/enlaza TableSession y pasa a Seated.</summary>
    Task<ReservationActionResult> SeatAsync(int id, SeatReservationDto dto, CancellationToken ct = default);

    /// <summary>Staff/automático: marca no-show y libera el pool.</summary>
    Task<ReservationActionResult> MarkNoShowAsync(int id, CancellationToken ct = default);

    /// <summary>Staff/público: cancela la reserva (política de ventana de cancelación).</summary>
    Task<ReservationActionResult> CancelAsync(int id, CancelReservationDto dto, CancellationToken ct = default);

    /// <summary>Staff: reprograma a una nueva fecha/hora re-validando la ventana (mismo lock+check que create).</summary>
    Task<ReservationActionResult> RescheduleAsync(int id, RescheduleReservationDto dto, CancellationToken ct = default);

    /// <summary>Portal público: solicita reservar una ZONA completa (uso exclusivo). Queda Pending para aprobación del host.</summary>
    Task<ReservationActionResult> CreateZoneRequestAsync(ZoneRequestDto dto, CancellationToken ct = default);

    /// <summary>Staff: responde una reserva de zona exclusiva — aceptar (bloquea toda la zona) o rechazar, con mensaje al cliente.</summary>
    Task<ReservationActionResult> RespondZoneAsync(int id, ZoneDecisionDto dto, CancellationToken ct = default);

    /// <summary>Público: estado de una reserva por confirmationCode (seguimiento).</summary>
    Task<ReservationTrackDto?> GetTrackAsync(string code, CancellationToken ct = default);
}
