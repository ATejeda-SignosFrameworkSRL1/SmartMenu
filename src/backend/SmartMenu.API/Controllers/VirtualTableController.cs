using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Entities;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VirtualTableController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<VirtualTableController> _logger;

    public VirtualTableController(ApplicationDbContext context, ILogger<VirtualTableController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Crear mesa virtual: el mesero escanea los QR de las mesas unidas.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateVirtualTableDto dto)
    {
        _logger.LogInformation($"🟢 CREATE VirtualTable - Name: {dto.Name}, CreatedByWaiterId: {dto.CreatedByWaiterId}, TableIds: [{string.Join(", ", dto.TableIds)}]");
        
        if (dto.TableIds == null || dto.TableIds.Count == 0)
            return BadRequest(new { error = "Debe incluir al menos una mesa" });

        if (dto.TableIds.Count < 2)
            return BadRequest(new { error = "Una mesa virtual requiere al menos 2 mesas" });

        var tables = await _context.Tables.Where(t => dto.TableIds.Contains(t.Id)).ToListAsync();
        var missing = dto.TableIds.Except(tables.Select(t => t.Id)).ToList();
        if (missing.Count > 0)
            return BadRequest(new { error = $"Mesas no encontradas: {string.Join(", ", missing)}" });

        // Verificar que ninguna mesa esté ya ocupada
        var occupiedTables = tables.Where(t => t.Status == Domain.Enums.TableStatus.Occupied).ToList();
        if (occupiedTables.Any())
        {
            var occupiedNumbers = string.Join(", ", occupiedTables.Select(t => $"#{t.TableNumber}"));
            return BadRequest(new { error = $"Las siguientes mesas ya están ocupadas: {occupiedNumbers}" });
        }

        // Verificar que ninguna de las mesas esté ya en otra mesa virtual activa
        var alreadyInVirtualTable = await _context.VirtualTableTables
            .Where(vtt => dto.TableIds.Contains(vtt.TableId) 
                && _context.VirtualTables.Any(vt => vt.Id == vtt.VirtualTableId && vt.IsActive))
            .Select(vtt => vtt.TableId)
            .ToListAsync();
        
        if (alreadyInVirtualTable.Any())
        {
            var tableNumbers = await _context.Tables
                .Where(t => alreadyInVirtualTable.Contains(t.Id))
                .Select(t => t.TableNumber)
                .ToListAsync();
            return BadRequest(new { error = $"Las siguientes mesas ya están en otra mesa virtual: {string.Join(", ", tableNumbers.Select(n => $"#{n}"))}" });
        }

        var vt = new VirtualTable
        {
            Name = dto.Name ?? $"Mesa Virtual {DateTime.UtcNow:HHmm}",
            CreatedByWaiterId = dto.CreatedByWaiterId,
            IsActive = true
        };
        
        _logger.LogInformation($"🟢 Guardando VirtualTable con CreatedByWaiterId: {vt.CreatedByWaiterId}");
        _context.VirtualTables.Add(vt);
        await _context.SaveChangesAsync();
        _logger.LogInformation($"🟢 VirtualTable guardada con ID: {vt.Id}");

        // Asociar mesas a la mesa virtual Y cambiar su estado a Occupied
        foreach (var table in tables)
        {
            _context.VirtualTableTables.Add(new VirtualTableTable { VirtualTableId = vt.Id, TableId = table.Id });
            table.Status = Domain.Enums.TableStatus.Occupied;
            _logger.LogInformation($"🟢 Mesa #{table.TableNumber} (ID: {table.Id}) marcada como Occupied");
        }
        await _context.SaveChangesAsync();
        _logger.LogInformation($"🟢 {dto.TableIds.Count} mesas asociadas a VirtualTable ID: {vt.Id} y marcadas como Occupied");

        return CreatedAtAction(nameof(Get), new { id = vt.Id }, new
        {
            vt.Id,
            vt.Name,
            vt.IsActive,
            vt.CreatedByWaiterId,
            TableIds = dto.TableIds
        });
    }

    /// <summary>
    /// Obtener mesa virtual por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var vt = await _context.VirtualTables
            .Include(v => v.Tables)
            .ThenInclude(t => t.Table)
            .ThenInclude(t => t.Zone)
            .FirstOrDefaultAsync(v => v.Id == id);
        if (vt == null)
            return NotFound(new { message = "Mesa virtual no encontrada" });

        return Ok(new
        {
            vt.Id,
            vt.Name,
            vt.IsActive,
            vt.CreatedByWaiterId,
            Tables = vt.Tables.Select(t => new
            {
                t.TableId,
                TableNumber = t.Table.TableNumber,
                ZoneName = t.Table.Zone?.Name
            }).ToList()
        });
    }

    /// <summary>
    /// Listar mesas virtuales activas del mesero
    /// </summary>
    [HttpGet("waiter/{waiterId}")]
    public async Task<IActionResult> GetByWaiter(int waiterId)
    {
        _logger.LogInformation($"🔵 GetByWaiter llamado con waiterId: {waiterId}");
        
        var allVirtualTables = await _context.VirtualTables.ToListAsync();
        _logger.LogInformation($"🔵 Total de mesas virtuales en DB: {allVirtualTables.Count}");
        
        foreach (var vt in allVirtualTables.Take(5))
        {
            _logger.LogInformation($"  - VT ID:{vt.Id}, Name:{vt.Name}, CreatedBy:{vt.CreatedByWaiterId}, IsActive:{vt.IsActive}");
        }
        
        // TEMPORAL: Devolver TODAS las mesas virtuales activas (sin filtrar por waiter) para debug
        var list = await _context.VirtualTables
            .Include(v => v.Tables)
            .ThenInclude(t => t.Table)
            .ThenInclude(t => t.Zone)
            .Where(v => v.IsActive) // SOLO filtro IsActive, no por waiter
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.IsActive,
                v.CreatedByWaiterId,
                Tables = v.Tables.Select(t => new
                {
                    Id = t.TableId,
                    TableNumber = t.Table.TableNumber,
                    ZoneName = t.Table.Zone != null ? t.Table.Zone.Name : ""
                }).ToList()
            })
            .ToListAsync();
            
        _logger.LogInformation($"🔵 Mesas virtuales ACTIVAS (todas, sin filtrar): {list.Count}");
        if (list.Count > 0)
        {
            _logger.LogInformation($"🔵 Primera mesa: {list[0].Name}, IsActive: {list[0].IsActive}, CreatedByWaiterId: {list[0].CreatedByWaiterId}");
        }
        
        return Ok(list);
    }

    /// <summary>
    /// Órdenes de todas las mesas que pertenecen a la mesa virtual (para vista unificada)
    /// </summary>
    [HttpGet("{id}/orders")]
    public async Task<IActionResult> GetOrders(int id)
    {
        var vt = await _context.VirtualTables
            .Include(v => v.Tables)
            .FirstOrDefaultAsync(v => v.Id == id);
        if (vt == null)
            return NotFound(new { message = "Mesa virtual no encontrada" });

        var tableIds = vt.Tables.Select(t => t.TableId).ToList();
        var orders = await _context.Orders
            .Include(o => o.Table)
            .Include(o => o.Items)
            .ThenInclude(i => i.Dish)
            .Where(o => o.TableId.HasValue && tableIds.Contains(o.TableId.Value) && o.Status != Domain.Enums.OrderStatus.Cancelled)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.OrderNumber,
                o.TableId,
                TableNumber = o.Table.TableNumber,
                o.Status,
                o.Total,
                o.CreatedAt,
                Items = o.Items.Select(i => new { i.DishId, DishName = i.Dish != null ? i.Dish.Name : "", i.Quantity, i.UnitPrice })
            })
            .ToListAsync();

        return Ok(orders);
    }

    /// <summary>
    /// Desactivar mesa virtual
    /// </summary>
    [HttpPut("{id}/deactivate")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var vt = await _context.VirtualTables
            .Include(v => v.Tables)
            .FirstOrDefaultAsync(v => v.Id == id);
        if (vt == null)
            return NotFound(new { message = "Mesa virtual no encontrada" });

        vt.IsActive = false;
        vt.DeactivatedAt = DateTime.UtcNow;
        
        // Liberar las mesas: volver su estado a Available
        var tableIds = vt.Tables.Select(t => t.TableId).ToList();
        var tables = await _context.Tables.Where(t => tableIds.Contains(t.Id)).ToListAsync();
        foreach (var table in tables)
        {
            table.Status = Domain.Enums.TableStatus.Available;
            _logger.LogInformation($"🗑️ Mesa #{table.TableNumber} (ID: {table.Id}) liberada (Available)");
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"🗑️ Mesa virtual ID {id} desactivada y {tables.Count} mesas liberadas");
        return Ok(new { message = "Mesa virtual desactivada", id = vt.Id, tablesReleased = tables.Count });
    }

    /// <summary>
    /// TEMPORAL: Desactivar TODAS las mesas virtuales activas (para testing)
    /// </summary>
    [HttpPost("deactivate-all")]
    public async Task<IActionResult> DeactivateAll()
    {
        var activeVTs = await _context.VirtualTables
            .Include(v => v.Tables)
            .Where(v => v.IsActive)
            .ToListAsync();
        
        int totalTablesReleased = 0;
        foreach (var vt in activeVTs)
        {
            vt.IsActive = false;
            vt.DeactivatedAt = DateTime.UtcNow;
            
            // Liberar las mesas de cada mesa virtual
            var tableIds = vt.Tables.Select(t => t.TableId).ToList();
            var tables = await _context.Tables.Where(t => tableIds.Contains(t.Id)).ToListAsync();
            foreach (var table in tables)
            {
                table.Status = Domain.Enums.TableStatus.Available;
                totalTablesReleased++;
            }
        }
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"🗑️ Desactivadas {activeVTs.Count} mesas virtuales y liberadas {totalTablesReleased} mesas");
        return Ok(new { 
            message = $"Desactivadas {activeVTs.Count} mesas virtuales y liberadas {totalTablesReleased} mesas",
            virtualTablesDeactivated = activeVTs.Count,
            tablesReleased = totalTablesReleased
        });
    }
}

public class CreateVirtualTableDto
{
    public string? Name { get; set; }
    public int CreatedByWaiterId { get; set; }
    public List<int> TableIds { get; set; } = new();
}
