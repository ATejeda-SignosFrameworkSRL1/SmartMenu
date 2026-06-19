namespace SmartMenu.Application.DTOs;

// ─────────────── Disponibilidad (capacidad dinámica por intervalo) ───────────────

/// <summary>Un slot reservable de la rejilla. status ∈ available|limited|full.</summary>
public record SlotDto(string Time, string Status, int Remaining, bool IsPast);

/// <summary>Una ventana de servicio (turno) con su rango horario.</summary>
public record ServiceWindowDto(string Label, string Start, string End);

/// <summary>Resultado de la búsqueda de disponibilidad para un día/party.</summary>
public class AvailabilityResultDto
{
    public string Date { get; set; } = string.Empty;     // yyyy-MM-dd
    public int Guests { get; set; }
    public int? ZoneId { get; set; }
    public int SlotMinutes { get; set; }
    public List<ServiceWindowDto> ServiceWindows { get; set; } = new();
    public List<SlotDto> Slots { get; set; } = new();
}

/// <summary>Factibilidad de un slot concreto (uso interno + recheck bajo lock).</summary>
public record SlotFeasibility(bool Bookable, int RemainingCovers);

// ─────────────── Calendario: ocupación por bloque ───────────────

/// <summary>Un bloque (slot) de la rejilla con su ocupación agregada. status ∈ available|limited|full.</summary>
public record OccupancyBlockDto(
    string Time,            // HH:mm
    int Covers,             // comensales que INICIAN en el slot
    int MaxCovers,          // tope de comensales del turno (0 = sin tope)
    int Reservations,       // reservas que INICIAN en el slot
    int MaxReservations,    // tope de reservas del turno (0 = sin tope)
    string Status);

/// <summary>Vista de ocupación del día: rejilla por turno con cargas agregadas por bloque.</summary>
public class OccupancyResultDto
{
    public string Date { get; set; } = string.Empty;     // yyyy-MM-dd
    public int SlotMinutes { get; set; }
    public List<ServiceWindowDto> ServiceWindows { get; set; } = new();
    public List<OccupancyBlockDto> Blocks { get; set; } = new();
}

// ─────────────── Calendario: disponibilidad por mesa ───────────────

/// <summary>Disponibilidad de una mesa Dining: en qué slots del día está libre.</summary>
public class TableAvailabilityDto
{
    public int TableId { get; set; }
    public int TableNumber { get; set; }
    public string ZoneName { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public List<string> FreeSlots { get; set; } = new();   // "HH:mm" en que la mesa está libre
}

/// <summary>Vista de disponibilidad por mesa del día.</summary>
public class TableAvailabilityResultDto
{
    public string Date { get; set; } = string.Empty;     // yyyy-MM-dd
    public int SlotMinutes { get; set; }
    public List<TableAvailabilityDto> Tables { get; set; } = new();
}

// ─────────────── Booking ───────────────

public class HoldRequestDto
{
    public string Date { get; set; } = string.Empty;   // yyyy-MM-dd (hora local RD)
    public string Time { get; set; } = string.Empty;   // HH:mm
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

/// <summary>Creación directa por staff (queda Confirmed). Acepta fecha+hora o ReservationDateTime.</summary>
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
    public int? TableId { get; set; }            // single (legacy / simple)
    public List<int>? TableIds { get; set; }     // combinación (grupos grandes)
    public string? RowVersion { get; set; }      // base64 (concurrencia optimista, opcional)
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
    public string? ConfirmationCode { get; set; }  // capability para cancelación pública
    public string? RowVersion { get; set; }
}

public class RescheduleReservationDto
{
    public DateTime NewDateTime { get; set; }
    public string? RowVersion { get; set; }
}

// ─────────────── Reserva de ZONA completa (exclusiva) + seguimiento ───────────────

/// <summary>Solicitud pública de reservar una ZONA completa (uso exclusivo). Queda Pending para que el host apruebe/rechace.</summary>
public class ZoneRequestDto
{
    public string Date { get; set; } = string.Empty;   // yyyy-MM-dd
    public string Time { get; set; } = string.Empty;   // HH:mm
    public int Guests { get; set; }
    public int ZoneId { get; set; }                     // zona objetivo (obligatoria)
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int OccasionType { get; set; }
    public string? SpecialRequests { get; set; }
}

/// <summary>Decisión del host sobre una reserva de zona exclusiva: aceptar (bloquea la zona) o rechazar, con mensaje al cliente.</summary>
public class ZoneDecisionDto
{
    public bool Accept { get; set; }
    public string? Message { get; set; }   // mensaje al cliente (visible en seguimiento)
}

/// <summary>Estado público de una reserva por confirmationCode (página de seguimiento).</summary>
public class ReservationTrackDto
{
    public string Status { get; set; } = string.Empty;
    public bool IsZoneExclusive { get; set; }
    public string? ZoneName { get; set; }
    public string ReservationDateTime { get; set; } = string.Empty; // yyyy-MM-ddTHH:mm:ss
    public int NumberOfGuests { get; set; }
    public int OccasionType { get; set; }
    public string? HostResponseMessage { get; set; }
    public int AssignedTableCount { get; set; }
    public string CustomerName { get; set; } = string.Empty;
}

/// <summary>Resultado uniforme de las operaciones de reserva. El controller mapea Code→HTTP.</summary>
public class ReservationActionResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? Code { get; set; }              // SLOT_FULL, CONFLICT, STALE, NOT_FOUND, BAD_STATE…
    public int? ReservationId { get; set; }
    public string? ConfirmationCode { get; set; }
    public string? Status { get; set; }
    public DateTime? HoldExpiresAt { get; set; }
    public string? ReservationDateTime { get; set; }   // yyyy-MM-ddTHH:mm:ss (naive-local)
    public List<int>? AssignedTableIds { get; set; }
    public int? TableSessionId { get; set; }

    public static ReservationActionResult Fail(string error, string code) =>
        new() { Success = false, Error = error, Code = code };
}
