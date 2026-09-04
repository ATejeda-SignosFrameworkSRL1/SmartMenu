using SmartMenu.Application.DTOs;
using SmartMenu.Domain.Entities;

namespace SmartMenu.Application.Services;

public interface IReservationAvailabilityService
{

    Task<AvailabilityResultDto> GetSlotsAsync(DateOnly date, int partySize, int? zoneId, CancellationToken ct = default);

    Task<SlotFeasibility> CheckSlotAsync(ServicePeriod period, DateTime startLocal, int partySize, int? zoneId, int? excludeReservationId, CancellationToken ct = default);

    Task<OccupancyResultDto> GetOccupancyAsync(DateOnly date, CancellationToken ct = default);

    Task<TableAvailabilityResultDto> GetTableAvailabilityAsync(DateOnly date, CancellationToken ct = default);
}
