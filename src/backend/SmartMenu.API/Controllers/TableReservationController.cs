using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.API.Hubs;
using SmartMenu.Application.Common;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TableReservationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TableReservationController> _logger;
    private readonly IHubContext<ReservationHub> _reservationHub;
    private readonly IReservationService _svc;
    private readonly IReservationAvailabilityService _availability;

    public TableReservationController(
        ApplicationDbContext context,
        ILogger<TableReservationController> logger,
        IHubContext<ReservationHub> reservationHub,
        IReservationService svc,
        IReservationAvailabilityService availability)
    {
        _context = context;
        _logger = logger;
        _reservationHub = reservationHub;
        _svc = svc;
        _availability = availability;
    }

    // ─────────────────────────── Lectura ───────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetReservations([FromQuery] string? date)
    {
        try
        {
            var reservations = await _context.TableReservations
                .Include(r => r.Table).ThenInclude(t => t!.Zone)
                .Include(r => r.RequestedZone)
                .Include(r => r.CreatedByHost)
                .Include(r => r.AssignedTables)
                .Include(r => r.PreOrder).ThenInclude(p => p.Items).ThenInclude(i => i.Dish)
                .Where(r => !r.IsCancelled)
                .OrderBy(r => r.ReservationDateTime)
                .Select(r => new
                {
                    id = r.Id,
                    customerName = r.CustomerName,
                    customerPhone = r.CustomerPhone,
                    customerEmail = r.CustomerEmail,
                    numberOfGuests = r.NumberOfGuests,
                    reservationDateTime = r.ReservationDateTime,
                    endDateTime = r.EndDateTime,
                    durationMinutes = r.DurationMinutes,
                    reservedUntil = r.ReservedUntil,
                    // Máquina de estados nueva + bool legacy (compat con apps que aún leen isConfirmed).
                    status = r.Status.ToString(),
                    isConfirmed = r.IsConfirmed,
                    servicePeriodId = r.ServicePeriodId,
                    seatedAt = r.SeatedAt,
                    noShowAt = r.NoShowAt,
                    confirmationCode = r.ConfirmationCode,
                    tableId = r.TableId,
                    tableNumber = r.Table != null ? (int?)r.Table.TableNumber : null,
                    assignedTableIds = r.AssignedTables.Select(at => at.TableId).ToList(),
                    zoneName = r.Table != null ? r.Table.Zone.Name : (r.RequestedZone != null ? r.RequestedZone.Name : null),
                    requestedZoneId = r.RequestedZoneId,
                    requestedZoneName = r.RequestedZone != null ? r.RequestedZone.Name : null,
                    specialRequests = r.SpecialRequests,
                    occasionType = (int)r.OccasionType,
                    advanceBlockMinutes = r.AdvanceBlockMinutes,
                    source = r.Source,
                    createdByHostId = r.CreatedByHostId,
                    createdByHostName = r.CreatedByHost != null ? r.CreatedByHost.FirstName + " " + r.CreatedByHost.LastName : null,
                    preOrder = r.PreOrder == null ? null : new
                    {
                        id = r.PreOrder.Id,
                        notes = r.PreOrder.Notes,
                        items = r.PreOrder.Items.Select(i => new
                        {
                            dishId = i.DishId,
                            dishName = i.Dish != null ? i.Dish.Name : "",
                            quantity = i.Quantity,
                            notes = i.Notes,
                            unitPrice = i.Dish != null ? i.Dish.Price : 0
                        }).ToList()
                    }
                })
                .ToListAsync();

            return Ok(reservations);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reservations");
            return StatusCode(500, new { error = "Error al obtener reservas" });
        }
    }

    // ─────────────────────────── Disponibilidad (pública) ───────────────────────────

    /// <summary>Rejilla de slots reservables para una fecha/party (capacidad dinámica por intervalo).</summary>
    [HttpGet("availability/slots")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSlots([FromQuery] string date, [FromQuery] int guests, [FromQuery] int? zoneId, CancellationToken ct)
    {
        if (!DateOnly.TryParse(date, out var d))
            return BadRequest(new { error = "Fecha inválida (use yyyy-MM-dd)" });
        if (guests < 1) return BadRequest(new { error = "guests inválido" });
        var result = await _availability.GetSlotsAsync(d, guests, zoneId, ct);
        return Ok(result);
    }

    // ─────────────────────────── Calendario (staff) ───────────────────────────

    /// <summary>Vista de ocupación del día: por bloque, comensales/reservas que inician y su status.</summary>
    [HttpGet("availability/occupancy")]
    public async Task<IActionResult> GetOccupancy([FromQuery] string date, CancellationToken ct)
    {
        if (!DateOnly.TryParse(date, out var d))
            return BadRequest(new { error = "Fecha inválida (use yyyy-MM-dd)" });
        var result = await _availability.GetOccupancyAsync(d, ct);
        return Ok(result);
    }

    /// <summary>Disponibilidad por mesa del día: para cada mesa Dining, los slots en que está libre.</summary>
    [HttpGet("availability/tables")]
    public async Task<IActionResult> GetTableAvailability([FromQuery] string date, CancellationToken ct)
    {
        if (!DateOnly.TryParse(date, out var d))
            return BadRequest(new { error = "Fecha inválida (use yyyy-MM-dd)" });
        var result = await _availability.GetTableAvailabilityAsync(d, ct);
        return Ok(result);
    }

    /// <summary>Portal público: toma un hold de un slot (~HoldTtl min). Atómico.</summary>
    [HttpPost("hold")]
    [AllowAnonymous]
    public async Task<IActionResult> Hold([FromBody] HoldRequestDto dto, CancellationToken ct)
    {
        var r = await _svc.CreateHoldAsync(dto, ct);
        return Map(r);
    }

    /// <summary>Portal público: confirma un hold con el confirmationCode + datos de contacto.</summary>
    [HttpPut("{id}/confirm-public")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmPublic(int id, [FromBody] ConfirmPublicDto dto, CancellationToken ct)
    {
        var r = await _svc.ConfirmPublicAsync(id, dto, ct);
        if (r.Success)
        {
            await FireNewReservationAsync(id, ct);
            await FireAvailabilityChangedAsync(r.ReservationDateTime, ct);
        }
        return Map(r);
    }

    // ─────────────────────────── Creación (staff) ───────────────────────────

    [HttpPost]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationDto dto, CancellationToken ct)
    {
        var staff = new CreateReservationStaffDto
        {
            ReservationDateTime = dto.ReservationDateTime,
            NumberOfGuests = dto.NumberOfGuests,
            ZoneId = dto.RequestedZoneId,
            TableId = dto.TableId,
            CustomerName = dto.CustomerName,
            CustomerPhone = dto.CustomerPhone,
            CustomerEmail = dto.CustomerEmail,
            OccasionType = dto.OccasionType,
            SpecialRequests = dto.SpecialRequests,
            HostId = CurrentUserId() ?? dto.HostId,
        };
        var r = await _svc.CreateStaffAsync(staff, ct);
        if (r.Success)
        {
            await FireNewReservationAsync(r.ReservationId!.Value, ct);
            await FireAvailabilityChangedAsync(r.ReservationDateTime, ct);
        }
        return Map(r);
    }

    // ─────────────────────────── Asignación / sentar ───────────────────────────

    [HttpPut("{id}/assign-table")]
    public async Task<IActionResult> AssignTable(int id, [FromBody] AssignTableDto dto, CancellationToken ct)
    {
        var r = await _svc.AssignTableAsync(id, dto, ct);
        if (r.Success)
        {
            var tableNumber = await _context.Tables.Where(t => t.Id == (r.AssignedTableIds!.FirstOrDefault()))
                .Select(t => (int?)t.TableNumber).FirstOrDefaultAsync(ct);
            await _reservationHub.Clients.All.SendAsync("ReservationTableAssigned", new
            {
                reservationId = id,
                tableId = r.AssignedTableIds!.FirstOrDefault(),
                tableIds = r.AssignedTableIds,
                tableNumber,
                timestamp = DateTime.UtcNow
            }, ct);
        }
        return Map(r);
    }

    /// <summary>Auto-asigna la mejor mesa disponible (menor capacidad que sirva, libre en la ventana).</summary>
    [HttpPost("{id}/auto-assign")]
    public async Task<IActionResult> AutoAssign(int id, CancellationToken ct)
    {
        var r = await _svc.AutoAssignAsync(id, ct);
        if (r.Success)
            await _reservationHub.Clients.All.SendAsync("ReservationTableAssigned", new
            {
                reservationId = id,
                tableId = r.AssignedTableIds!.FirstOrDefault(),
                tableIds = r.AssignedTableIds,
                timestamp = DateTime.UtcNow
            }, ct);
        return Map(r);
    }

    /// <summary>Sugiere la mejor mesa (menor capacidad ≥ party) libre en la ventana de la reserva.</summary>
    [HttpGet("{id}/suggest-table")]
    public async Task<IActionResult> SuggestTable(int id, [FromQuery] int? zoneId, CancellationToken ct)
    {
        var res = await _context.TableReservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (res == null) return NotFound(new { error = "Reserva no encontrada" });
        int? zone = zoneId ?? res.RequestedZoneId;

        var candidates = await _context.Tables
            .Where(t => t.Zone.Type == "Dining" && t.Capacity >= res.NumberOfGuests && (zone == null || t.ZoneId == zone))
            .OrderBy(t => t.Capacity).ThenBy(t => t.Id)
            .Select(t => new { t.Id, t.TableNumber, t.Capacity, ZoneName = t.Zone.Name })
            .ToListAsync(ct);

        foreach (var c in candidates)
        {
            bool busy = await IsTableBusyAsync(c.Id, res.ReservationDateTime, res.EndDateTime, res.Id, ct);
            if (!busy)
                return Ok(new { tableId = c.Id, tableNumber = c.TableNumber, capacity = c.Capacity, zoneName = c.ZoneName });
        }
        return Ok(new { tableId = (int?)null, message = "No hay mesa libre en esa ventana" });
    }

    [HttpPut("{id}/seat")]
    public async Task<IActionResult> Seat(int id, [FromBody] SeatReservationDto dto, CancellationToken ct)
    {
        dto.HostId ??= CurrentUserId();
        var r = await _svc.SeatAsync(id, dto, ct);
        if (r.Success)
        {
            await _reservationHub.Clients.All.SendAsync("ReservationSeated", new
            {
                reservationId = id,
                tableId = r.AssignedTableIds!.FirstOrDefault(),
                tableSessionId = r.TableSessionId,
                timestamp = DateTime.UtcNow
            }, ct);
            await FireAvailabilityChangedAsync(r.ReservationDateTime, ct);
        }
        return Map(r);
    }

    [HttpPut("{id}/no-show")]
    public async Task<IActionResult> NoShow(int id, CancellationToken ct)
    {
        var r = await _svc.MarkNoShowAsync(id, ct);
        if (r.Success)
        {
            await _reservationHub.Clients.All.SendAsync("ReservationNoShow", new { reservationId = id, timestamp = DateTime.UtcNow }, ct);
            await FireAvailabilityChangedAsync(r.ReservationDateTime, ct);
        }
        return Map(r);
    }

    // ─────────────────────────── Confirmar / cancelar / reprogramar ───────────────────────────

    [HttpPut("{id}/confirm")]
    public async Task<IActionResult> ConfirmReservation(int id, [FromQuery] string? rowVersion, CancellationToken ct)
    {
        var r = await _svc.ConfirmAsync(id, rowVersion, ct);
        if (r.Success)
            await _reservationHub.Clients.All.SendAsync("ReservationConfirmed", new { reservationId = id, timestamp = DateTime.UtcNow }, ct);
        return Map(r);
    }

    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelReservation(int id, [FromBody] CancelReservationDto? dto, CancellationToken ct)
    {
        var r = await _svc.CancelAsync(id, dto ?? new CancelReservationDto(), ct);
        if (r.Success)
        {
            await _reservationHub.Clients.All.SendAsync("ReservationCancelled", new { reservationId = id, timestamp = DateTime.UtcNow }, ct);
            await FireAvailabilityChangedAsync(r.ReservationDateTime, ct);
        }
        return Map(r);
    }

    [HttpPut("{id}/reschedule")]
    public async Task<IActionResult> RescheduleReservation(int id, [FromBody] RescheduleReservationDto dto, CancellationToken ct)
    {
        var r = await _svc.RescheduleAsync(id, dto, ct);
        if (r.Success)
        {
            await _reservationHub.Clients.All.SendAsync("ReservationRescheduled", new { reservationId = id, newDateTime = r.ReservationDateTime, timestamp = DateTime.UtcNow }, ct);
            await FireAvailabilityChangedAsync(r.ReservationDateTime, ct);
        }
        return Map(r);
    }

    // ─────────────────────────── Mesas disponibles (window-overlap, reemplaza day-wide) ───────────────────────────

    /// <summary>Mesas físicas libres para asignar a una reserva (solape de ventana, no día completo).</summary>
    [HttpGet("{id}/available-tables")]
    public async Task<IActionResult> GetAvailableTablesForReservation(int id, [FromQuery] int? zoneId, CancellationToken ct)
    {
        var reservation = await _context.TableReservations.Include(r => r.Table).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (reservation == null) return NotFound(new { error = "Reserva no encontrada" });

        var effectiveZoneId = zoneId ?? reservation.RequestedZoneId ?? reservation.Table?.ZoneId;

        var busy = await BusyTableIdsAsync(reservation.ReservationDateTime, reservation.EndDateTime, reservation.Id, ct);

        var query = _context.Tables.AsNoTracking()
            .Where(t => t.Zone.Type == "Dining" && t.Capacity >= reservation.NumberOfGuests);
        if (effectiveZoneId != null)
            query = query.Where(t => t.ZoneId == effectiveZoneId.Value);

        var tables = await query
            .Select(t => new { t.Id, t.TableNumber, t.Capacity, ZoneName = t.Zone.Name })
            .OrderBy(t => t.Capacity).ThenBy(t => t.TableNumber)
            .ToListAsync(ct);

        var result = tables.Select(t => new
        {
            id = t.Id,
            tableNumber = t.TableNumber,
            capacity = t.Capacity,
            zoneName = t.ZoneName,
            isOccupied = busy.Contains(t.Id),
            isCurrent = reservation.TableId == t.Id
        });
        return Ok(result);
    }

    /// <summary>Mesas disponibles públicas para una fecha/hora (solape de ventana). Legacy — el portal nuevo usa /availability/slots.</summary>
    [HttpGet("public/available-tables")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAvailableTables([FromQuery] DateTime dateTime, [FromQuery] int guests, CancellationToken ct)
    {
        var startLocal = DateTime.SpecifyKind(dateTime, DateTimeKind.Unspecified);
        var endLocal = startLocal.AddMinutes(100); // duración default + colchón aproximado
        var busy = await BusyTableIdsAsync(startLocal, endLocal, null, ct);

        var availableTables = await _context.Tables
            .Where(t => t.Zone.Type == "Dining" && t.Capacity >= guests)
            .Select(t => new { t.Id, t.TableNumber, t.Capacity, ZoneName = t.Zone.Name })
            .OrderBy(t => t.Capacity)
            .ToListAsync(ct);

        return Ok(availableTables.Where(t => !busy.Contains(t.Id))
            .Select(t => new { id = t.Id, tableNumber = t.TableNumber, capacity = t.Capacity, zoneName = t.ZoneName }));
    }

    // ─────────────────────────── Pre-order (sin cambios) ───────────────────────────

    [HttpPost("{id}/preorder")]
    public async Task<IActionResult> SetPreOrder(int id, [FromBody] CreatePreOrderDto dto)
    {
        try
        {
            var reservation = await _context.TableReservations.FindAsync(id);
            if (reservation == null) return NotFound(new { error = "Reserva no encontrada" });

            var existing = await _context.ReservationPreOrders.Include(p => p.Items).FirstOrDefaultAsync(p => p.ReservationId == id);
            if (existing != null)
            {
                _context.PreOrderItems.RemoveRange(existing.Items);
                _context.ReservationPreOrders.Remove(existing);
            }

            var preOrder = new ReservationPreOrder { ReservationId = id, Notes = dto.Notes };
            _context.ReservationPreOrders.Add(preOrder);
            await _context.SaveChangesAsync();

            foreach (var item in dto.Items)
                _context.PreOrderItems.Add(new PreOrderItem { PreOrderId = preOrder.Id, DishId = item.DishId, Quantity = item.Quantity, Notes = item.Notes });
            await _context.SaveChangesAsync();

            return Ok(new { id = preOrder.Id, message = "Pre-orden guardada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving pre-order for reservation {Id}", id);
            return StatusCode(500, new { error = "Error al guardar pre-orden" });
        }
    }

    [HttpGet("{id}/preorder")]
    public async Task<IActionResult> GetPreOrder(int id)
    {
        try
        {
            var preOrder = await _context.ReservationPreOrders.Include(p => p.Items).ThenInclude(i => i.Dish)
                .FirstOrDefaultAsync(p => p.ReservationId == id);
            if (preOrder == null) return Ok(new { hasPreOrder = false });

            return Ok(new
            {
                hasPreOrder = true,
                id = preOrder.Id,
                notes = preOrder.Notes,
                items = preOrder.Items.Select(i => new
                {
                    dishId = i.DishId,
                    dishName = i.Dish?.Name ?? "",
                    dishPrice = i.Dish?.Price ?? 0,
                    quantity = i.Quantity,
                    notes = i.Notes
                }).ToList(),
                total = preOrder.Items.Sum(i => (i.Dish?.Price ?? 0) * i.Quantity)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting pre-order for reservation {Id}", id);
            return StatusCode(500, new { error = "Error al obtener pre-orden" });
        }
    }

    // ─────────────────────────── Helpers ───────────────────────────

    private int? CurrentUserId()
    {
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(sub, out var uid) && uid > 0 ? uid : null;
    }

    private IActionResult Map(ReservationActionResult r)
    {
        if (r.Success) return Ok(r);
        return r.Code switch
        {
            "NOT_FOUND" => NotFound(new { error = r.Error, code = r.Code }),
            "SLOT_FULL" or "CONFLICT" or "STALE" => Conflict(new { error = r.Error, code = r.Code }),
            "BUSY" => StatusCode(429, new { error = r.Error, code = r.Code }),
            "BAD_CODE" => Unauthorized(new { error = r.Error, code = r.Code }),
            _ => BadRequest(new { error = r.Error, code = r.Code }),
        };
    }

    private async Task<HashSet<int>> BusyTableIdsAsync(DateTime start, DateTime end, int? excludeId, CancellationToken ct)
    {
        int exclude = excludeId ?? -1;
        var byField = await _context.TableReservations
            .Where(r => ReservationMath.ActiveStatuses.Contains(r.Status)
                     && r.Id != exclude
                     && r.TableId != null
                     && r.ReservationDateTime < end && start < r.EndDateTime)
            .Select(r => r.TableId!.Value).ToListAsync(ct);
        var byJoin = await _context.ReservationTables
            .Where(rt => ReservationMath.ActiveStatuses.Contains(rt.Reservation.Status)
                      && rt.ReservationId != exclude
                      && rt.Reservation.ReservationDateTime < end && start < rt.Reservation.EndDateTime)
            .Select(rt => rt.TableId).ToListAsync(ct);
        var set = new HashSet<int>(byField);
        set.UnionWith(byJoin);
        return set;
    }

    private async Task<bool> IsTableBusyAsync(int tableId, DateTime start, DateTime end, int excludeId, CancellationToken ct)
        => (await BusyTableIdsAsync(start, end, excludeId, ct)).Contains(tableId);

    private async Task FireAvailabilityChangedAsync(string? reservationDateTimeIso, CancellationToken ct)
    {
        string? date = reservationDateTimeIso != null && reservationDateTimeIso.Length >= 10
            ? reservationDateTimeIso[..10] : null;
        await _reservationHub.Clients.All.SendAsync("AvailabilityChanged", new { date, timestamp = DateTime.UtcNow }, ct);
    }

    private async Task FireNewReservationAsync(int id, CancellationToken ct)
    {
        var r = await _context.TableReservations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r == null) return;
        await _reservationHub.Clients.All.SendAsync("NewReservation", new
        {
            id = r.Id,
            customerName = r.CustomerName,
            customerPhone = r.CustomerPhone,
            customerEmail = r.CustomerEmail,
            numberOfGuests = r.NumberOfGuests,
            reservationDateTime = r.ReservationDateTime,
            tableId = r.TableId,
            requestedZoneId = r.RequestedZoneId,
            specialRequests = r.SpecialRequests,
            source = r.Source,
            status = r.Status.ToString(),
            timestamp = DateTime.UtcNow
        }, ct);
    }
}

public class CreatePreOrderDto
{
    public string? Notes { get; set; }
    public List<PreOrderItemDto> Items { get; set; } = new();
}

public class PreOrderItemDto
{
    public int DishId { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
}

public class CreateReservationDto
{
    public int? TableId { get; set; }
    public int? RequestedZoneId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int NumberOfGuests { get; set; }
    public DateTime ReservationDateTime { get; set; }
    public string? SpecialRequests { get; set; }
    public int OccasionType { get; set; } = 0;
    public int? HostId { get; set; }
    public int AdvanceBlockMinutes { get; set; } = 60;
}
