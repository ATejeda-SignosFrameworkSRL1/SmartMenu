using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

/// <summary>
/// CRUD de turnos de servicio (ServicePeriod). Define la rejilla de slots, duraciones,
/// colchón y topes de pacing por intervalo. Solo Admin/Manager.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class ServicePeriodController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ServicePeriodController> _logger;

    public ServicePeriodController(ApplicationDbContext context, ILogger<ServicePeriodController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = true)
    {
        var query = _context.ServicePeriods.AsNoTracking();
        if (!includeInactive) query = query.Where(p => p.IsActive);
        var periods = await query.OrderBy(p => p.StartTime).ToListAsync();
        return Ok(periods.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ServicePeriodDto dto)
    {
        if (!TimeOnly.TryParse(dto.StartTime, out var start) || !TimeOnly.TryParse(dto.EndTime, out var end))
            return BadRequest(new { error = "Hora inválida (use HH:mm)" });
        if (end <= start) return BadRequest(new { error = "EndTime debe ser mayor que StartTime" });
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { error = "Nombre requerido" });

        int restaurantId = dto.RestaurantId;
        if (restaurantId <= 0)
            restaurantId = await _context.Restaurants.OrderBy(r => r.Id).Select(r => r.Id).FirstOrDefaultAsync();
        if (restaurantId <= 0) return BadRequest(new { error = "No hay restaurante" });

        var entity = new ServicePeriod { RestaurantId = restaurantId };
        Apply(entity, dto, start, end);
        _context.ServicePeriods.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(ToDto(entity));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] ServicePeriodDto dto)
    {
        var entity = await _context.ServicePeriods.FirstOrDefaultAsync(p => p.Id == id);
        if (entity == null) return NotFound(new { error = "Turno no encontrado" });
        if (!TimeOnly.TryParse(dto.StartTime, out var start) || !TimeOnly.TryParse(dto.EndTime, out var end))
            return BadRequest(new { error = "Hora inválida (use HH:mm)" });
        if (end <= start) return BadRequest(new { error = "EndTime debe ser mayor que StartTime" });

        Apply(entity, dto, start, end);
        await _context.SaveChangesAsync();
        return Ok(ToDto(entity));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var entity = await _context.ServicePeriods.FirstOrDefaultAsync(p => p.Id == id);
        if (entity == null) return NotFound(new { error = "Turno no encontrado" });
        entity.IsActive = false;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Turno desactivado" });
    }

    private static void Apply(ServicePeriod e, ServicePeriodDto dto, TimeOnly start, TimeOnly end)
    {
        e.Name = dto.Name.Trim();
        e.DaysOfWeekMask = dto.DaysOfWeekMask <= 0 ? 127 : dto.DaysOfWeekMask;
        e.StartTime = start;
        e.EndTime = end;
        e.SlotMinutes = dto.SlotMinutes <= 0 ? 30 : dto.SlotMinutes;
        e.DefaultDurationMinutes = dto.DefaultDurationMinutes <= 0 ? 90 : dto.DefaultDurationMinutes;
        e.TurnoverBufferMinutes = Math.Max(0, dto.TurnoverBufferMinutes);
        e.MaxCoversPerSlot = Math.Max(0, dto.MaxCoversPerSlot);
        e.MaxReservationsPerSlot = Math.Max(0, dto.MaxReservationsPerSlot);
        e.LeadTimeMinutes = Math.Max(0, dto.LeadTimeMinutes);
        e.MaxHorizonDays = dto.MaxHorizonDays <= 0 ? 60 : dto.MaxHorizonDays;
        e.IsActive = dto.IsActive;
        e.LargePartyThreshold = dto.LargePartyThreshold;
        e.LargePartyDurationMinutes = dto.LargePartyDurationMinutes;
    }

    private static object ToDto(ServicePeriod p) => new
    {
        id = p.Id,
        restaurantId = p.RestaurantId,
        name = p.Name,
        daysOfWeekMask = p.DaysOfWeekMask,
        startTime = p.StartTime.ToString("HH:mm"),
        endTime = p.EndTime.ToString("HH:mm"),
        slotMinutes = p.SlotMinutes,
        defaultDurationMinutes = p.DefaultDurationMinutes,
        turnoverBufferMinutes = p.TurnoverBufferMinutes,
        maxCoversPerSlot = p.MaxCoversPerSlot,
        maxReservationsPerSlot = p.MaxReservationsPerSlot,
        leadTimeMinutes = p.LeadTimeMinutes,
        maxHorizonDays = p.MaxHorizonDays,
        isActive = p.IsActive,
        largePartyThreshold = p.LargePartyThreshold,
        largePartyDurationMinutes = p.LargePartyDurationMinutes,
    };
}

public class ServicePeriodDto
{
    public int RestaurantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DaysOfWeekMask { get; set; } = 127;
    public string StartTime { get; set; } = "12:00";
    public string EndTime { get; set; } = "15:00";
    public int SlotMinutes { get; set; } = 30;
    public int DefaultDurationMinutes { get; set; } = 90;
    public int TurnoverBufferMinutes { get; set; } = 10;
    public int MaxCoversPerSlot { get; set; }
    public int MaxReservationsPerSlot { get; set; }
    public int LeadTimeMinutes { get; set; } = 30;
    public int MaxHorizonDays { get; set; } = 60;
    public bool IsActive { get; set; } = true;
    public int? LargePartyThreshold { get; set; }
    public int? LargePartyDurationMinutes { get; set; }
}
