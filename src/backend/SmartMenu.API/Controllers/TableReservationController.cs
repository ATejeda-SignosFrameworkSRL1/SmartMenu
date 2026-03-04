using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TableReservationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TableReservationController> _logger;

    public TableReservationController(ApplicationDbContext context, ILogger<TableReservationController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetReservations([FromQuery] DateTime? date)
    {
        try
        {
            var query = _context.TableReservations
                .Include(r => r.Table)
                .ThenInclude(t => t.Zone)
                .Where(r => !r.IsCancelled);

            if (date.HasValue)
            {
                var startDate = date.Value.Date;
                var endDate = startDate.AddDays(1);
                query = query.Where(r => r.ReservationDateTime >= startDate && r.ReservationDateTime < endDate);
            }

            var reservations = await query
                .OrderBy(r => r.ReservationDateTime)
                .Select(r => new
                {
                    r.Id,
                    r.CustomerName,
                    r.CustomerPhone,
                    r.NumberOfGuests,
                    r.ReservationDateTime,
                    r.IsConfirmed,
                    TableNumber = r.Table.TableNumber,
                    ZoneName = r.Table.Zone.Name,
                    r.SpecialRequests
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

    [HttpPost]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationDto dto)
    {
        try
        {
            // La mesa no se puede usar por otros hasta ReservedUntil (evita roces con la reserva)
            var reservedUntil = dto.ReservationDateTime.AddMinutes(30);

            var reservation = new TableReservation
            {
                TableId = dto.TableId,
                CustomerName = dto.CustomerName,
                CustomerPhone = dto.CustomerPhone,
                CustomerEmail = dto.CustomerEmail,
                NumberOfGuests = dto.NumberOfGuests,
                ReservationDateTime = dto.ReservationDateTime,
                ReservedUntil = reservedUntil,
                SpecialRequests = dto.SpecialRequests,
                CreatedByHostId = dto.HostId,
                IsConfirmed = false
            };

            _context.TableReservations.Add(reservation);
            await _context.SaveChangesAsync();

            return Ok(new { id = reservation.Id, message = "Reserva creada exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating reservation");
            return StatusCode(500, new { error = "Error al crear reserva" });
        }
    }

    [HttpPut("{id}/confirm")]
    public async Task<IActionResult> ConfirmReservation(int id)
    {
        try
        {
            var reservation = await _context.TableReservations.FindAsync(id);
            if (reservation == null)
                return NotFound(new { error = "Reserva no encontrada" });

            reservation.IsConfirmed = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Reserva confirmada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error confirming reservation {ReservationId}", id);
            return StatusCode(500, new { error = "Error al confirmar reserva" });
        }
    }

    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelReservation(int id)
    {
        try
        {
            var reservation = await _context.TableReservations.FindAsync(id);
            if (reservation == null)
                return NotFound(new { error = "Reserva no encontrada" });

            reservation.IsCancelled = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Reserva cancelada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling reservation {ReservationId}", id);
            return StatusCode(500, new { error = "Error al cancelar reserva" });
        }
    }
}

public class CreateReservationDto
{
    public int TableId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int NumberOfGuests { get; set; }
    public DateTime ReservationDateTime { get; set; }
    public string? SpecialRequests { get; set; }
    public int? HostId { get; set; }
}
