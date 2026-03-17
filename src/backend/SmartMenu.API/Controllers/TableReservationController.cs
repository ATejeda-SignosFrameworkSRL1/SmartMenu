using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.API.Hubs;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TableReservationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TableReservationController> _logger;
    private readonly IHubContext<ReservationHub> _reservationHub;

    public TableReservationController(
        ApplicationDbContext context,
        ILogger<TableReservationController> logger,
        IHubContext<ReservationHub> reservationHub)
    {
        _context = context;
        _logger = logger;
        _reservationHub = reservationHub;
    }

    [HttpGet]
    public async Task<IActionResult> GetReservations([FromQuery] string? date)
    {
        try
        {
            // Devolver siempre todas las reservas no canceladas y dejar que el frontend filtre por fecha local
            var reservations = await _context.TableReservations
                .Include(r => r.Table)
                .ThenInclude(t => t.Zone)
                .Include(r => r.PreOrder)
                .ThenInclude(p => p.Items)
                .ThenInclude(i => i.Dish)
                .Where(r => !r.IsCancelled)
                .OrderBy(r => r.ReservationDateTime)
                .Select(r => new
                {
                    id = r.Id,
                    customerName = r.CustomerName,
                    customerPhone = r.CustomerPhone,
                    numberOfGuests = r.NumberOfGuests,
                    reservationDateTime = r.ReservationDateTime,
                    isConfirmed = r.IsConfirmed,
                    tableNumber = r.Table.TableNumber,
                    tableId = r.TableId,
                    zoneName = r.Table.Zone.Name,
                    specialRequests = r.SpecialRequests,
                    advanceBlockMinutes = r.AdvanceBlockMinutes,
                    source = r.Source,
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

    [HttpPost]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationDto dto)
    {
        try
        {
            var table = await _context.Tables.FindAsync(dto.TableId);
            if (table == null)
                return NotFound(new { error = "Mesa no encontrada" });

            var reservedUntil = dto.ReservationDateTime.AddHours(4);

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
                AdvanceBlockMinutes = dto.AdvanceBlockMinutes > 0 ? dto.AdvanceBlockMinutes : 60,
                IsConfirmed = true
            };

            _context.TableReservations.Add(reservation);
            // No cambiar el estado de la mesa aquí: GetTables la marcará como Reservada
            // automáticamente cuando falte ≤ 1 hora para la reserva.

            await _context.SaveChangesAsync();

            return Ok(new { id = reservation.Id, message = "Reserva creada exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating reservation");
            return StatusCode(500, new { error = "Error al crear reserva" });
        }
    }

    /// <summary>Public endpoint for portal reservations (no auth required, status=Pending)</summary>
    [HttpPost("public")]
    public async Task<IActionResult> CreatePublicReservation([FromBody] CreateReservationDto dto)
    {
        try
        {
            var table = await _context.Tables.FindAsync(dto.TableId);
            if (table == null)
                return NotFound(new { error = "Mesa no encontrada" });

            var reservedUntil = dto.ReservationDateTime.AddHours(4);

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
                AdvanceBlockMinutes = dto.AdvanceBlockMinutes > 0 ? dto.AdvanceBlockMinutes : 60,
                IsConfirmed = false,
                Source = "Portal"
            };

            _context.TableReservations.Add(reservation);
            await _context.SaveChangesAsync();

            // Notify host/admin in real-time via SignalR
            await _reservationHub.Clients.All.SendAsync("NewReservation", new
            {
                id = reservation.Id,
                customerName = reservation.CustomerName,
                customerPhone = reservation.CustomerPhone,
                customerEmail = reservation.CustomerEmail,
                numberOfGuests = reservation.NumberOfGuests,
                reservationDateTime = reservation.ReservationDateTime,
                tableNumber = table.TableNumber,
                tableId = reservation.TableId,
                specialRequests = reservation.SpecialRequests,
                source = "Portal",
                timestamp = DateTime.UtcNow
            });

            return Ok(new { id = reservation.Id, message = "Reserva recibida. Pendiente de confirmación." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating public reservation");
            return StatusCode(500, new { error = "Error al crear reserva" });
        }
    }

    /// <summary>Get available tables for a date/time (public)</summary>
    [HttpGet("public/available-tables")]
    public async Task<IActionResult> GetAvailableTables([FromQuery] DateTime dateTime, [FromQuery] int guests)
    {
        try
        {
            var blockWindow = dateTime.AddHours(-2);
            var endWindow = dateTime.AddHours(4);

            var reservedTableIds = await _context.TableReservations
                .Where(r => !r.IsCancelled
                         && r.ReservationDateTime >= blockWindow
                         && r.ReservationDateTime <= endWindow)
                .Select(r => r.TableId)
                .Distinct()
                .ToListAsync();

            var availableTables = await _context.Tables
                .Include(t => t.Zone)
                .Where(t => t.Capacity >= guests && !reservedTableIds.Contains(t.Id))
                .Where(t => t.Zone.Type == "Dining")
                .Select(t => new
                {
                    id = t.Id,
                    tableNumber = t.TableNumber,
                    capacity = t.Capacity,
                    zoneName = t.Zone.Name
                })
                .OrderBy(t => t.capacity)
                .ToListAsync();

            return Ok(availableTables);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting available tables");
            return StatusCode(500, new { error = "Error al obtener mesas disponibles" });
        }
    }

    [HttpPut("{id}/confirm")]
    public async Task<IActionResult> ConfirmReservation(int id)
    {
        try
        {
            var reservation = await _context.TableReservations
                .Include(r => r.Table)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null)
                return NotFound(new { error = "Reserva no encontrada" });

            reservation.IsConfirmed = true;

            await _context.SaveChangesAsync();

            await _reservationHub.Clients.All.SendAsync("ReservationConfirmed", new
            {
                reservationId = id,
                timestamp = DateTime.UtcNow
            });

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
            var reservation = await _context.TableReservations
                .Include(r => r.Table)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null)
                return NotFound(new { error = "Reserva no encontrada" });

            reservation.IsCancelled = true;

            // Liberar la mesa si estaba Reserved y no hay otra reserva próxima (≤1h)
            if (reservation.Table != null && reservation.Table.Status == SmartMenu.Domain.Enums.TableStatus.Reserved)
            {
                var now = DateTime.Now;
                var oneHourFromNow = now.AddHours(1);
                var otherProxima = await _context.TableReservations
                    .AnyAsync(r => r.TableId == reservation.TableId
                               && r.Id != id
                               && !r.IsCancelled
                               && r.ReservedUntil != null && r.ReservedUntil > now
                               && r.ReservationDateTime <= oneHourFromNow);
                if (!otherProxima)
                    reservation.Table.Status = SmartMenu.Domain.Enums.TableStatus.Available;
            }

            await _context.SaveChangesAsync();

            await _reservationHub.Clients.All.SendAsync("ReservationCancelled", new
            {
                reservationId = id,
                timestamp = DateTime.UtcNow
            });

            return Ok(new { message = "Reserva cancelada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling reservation {ReservationId}", id);
            return StatusCode(500, new { error = "Error al cancelar reserva" });
        }
    }

    /// <summary>Add or replace pre-order for a reservation</summary>
    [HttpPost("{id}/preorder")]
    public async Task<IActionResult> SetPreOrder(int id, [FromBody] CreatePreOrderDto dto)
    {
        try
        {
            var reservation = await _context.TableReservations.FindAsync(id);
            if (reservation == null)
                return NotFound(new { error = "Reserva no encontrada" });

            var existing = await _context.ReservationPreOrders
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p => p.ReservationId == id);

            if (existing != null)
            {
                _context.PreOrderItems.RemoveRange(existing.Items);
                _context.ReservationPreOrders.Remove(existing);
            }

            var preOrder = new ReservationPreOrder
            {
                ReservationId = id,
                Notes = dto.Notes
            };
            _context.ReservationPreOrders.Add(preOrder);
            await _context.SaveChangesAsync();

            foreach (var item in dto.Items)
            {
                _context.PreOrderItems.Add(new PreOrderItem
                {
                    PreOrderId = preOrder.Id,
                    DishId = item.DishId,
                    Quantity = item.Quantity,
                    Notes = item.Notes
                });
            }
            await _context.SaveChangesAsync();

            return Ok(new { id = preOrder.Id, message = "Pre-orden guardada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving pre-order for reservation {Id}", id);
            return StatusCode(500, new { error = "Error al guardar pre-orden" });
        }
    }

    /// <summary>Get pre-order for a reservation</summary>
    [HttpGet("{id}/preorder")]
    public async Task<IActionResult> GetPreOrder(int id)
    {
        try
        {
            var preOrder = await _context.ReservationPreOrders
                .Include(p => p.Items)
                .ThenInclude(i => i.Dish)
                .FirstOrDefaultAsync(p => p.ReservationId == id);

            if (preOrder == null)
                return Ok(new { hasPreOrder = false });

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
    public int TableId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int NumberOfGuests { get; set; }
    public DateTime ReservationDateTime { get; set; }
    public string? SpecialRequests { get; set; }
    public int? HostId { get; set; }
    public int AdvanceBlockMinutes { get; set; } = 60;
}
