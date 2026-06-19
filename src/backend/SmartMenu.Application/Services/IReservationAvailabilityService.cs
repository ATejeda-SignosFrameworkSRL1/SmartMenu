using SmartMenu.Application.DTOs;
using SmartMenu.Domain.Entities;

namespace SmartMenu.Application.Services;

/// <summary>
/// Motor de disponibilidad por intervalo: calcula los slots reservables de un día
/// (rejilla por turno) considerando topes de pacing y factibilidad física de mesas.
/// </summary>
public interface IReservationAvailabilityService
{
    /// <summary>Rejilla de slots reservables para una fecha y tamaño de party (zona opcional).</summary>
    Task<AvailabilityResultDto> GetSlotsAsync(DateOnly date, int partySize, int? zoneId, CancellationToken ct = default);

    /// <summary>
    /// Factibilidad de un inicio concreto dentro de un turno (pacing + física).
    /// Lo reutiliza el servicio de booking para re-validar DENTRO del lock antes de insertar.
    /// </summary>
    Task<SlotFeasibility> CheckSlotAsync(ServicePeriod period, DateTime startLocal, int partySize, int? zoneId, int? excludeReservationId, CancellationToken ct = default);

    /// <summary>
    /// Vista de ocupación del día (calendario): rejilla por turno con comensales/reservas que
    /// INICIAN en cada bloque y su status (available|limited|full) según los topes de pacing.
    /// </summary>
    Task<OccupancyResultDto> GetOccupancyAsync(DateOnly date, CancellationToken ct = default);

    /// <summary>
    /// Disponibilidad por mesa del día: para cada mesa Dining, los slots de la rejilla en que
    /// está libre (sin reserva activa asignada que solape la ventana estadía+colchón).
    /// </summary>
    Task<TableAvailabilityResultDto> GetTableAvailabilityAsync(DateOnly date, CancellationToken ct = default);
}
