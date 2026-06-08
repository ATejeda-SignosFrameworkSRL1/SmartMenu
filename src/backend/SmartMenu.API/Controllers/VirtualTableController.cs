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

        // VT-PAY: la mesa pagadora (si se indica) debe ser una de las mesas del grupo
        if (dto.PayerTableId.HasValue && !dto.TableIds.Contains(dto.PayerTableId.Value))
            return BadRequest(new { error = "La mesa pagadora debe ser una de las mesas seleccionadas." });

        // NOTA: Antes se rechazaban las mesas Ocupadas. Ahora SÍ se permite unir mesas
        // que ya tienen clientes/orden activa — sus órdenes existentes se muestran
        // unificadas en la vista de la mesa virtual (ver endpoint GetOrders).
        // La única restricción que se mantiene es que una mesa no esté ya en OTRA
        // mesa virtual activa al mismo tiempo (validación de abajo).

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
            PayerTableId = dto.PayerTableId,
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
            vt.PayerTableId,
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
                v.PayerTableId,
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
        
        // Liberar las mesas: volver a Available SOLO si ya no tienen órdenes activas.
        // (Como ahora una VT puede unir mesas que ya tenían cliente/orden, al deshacerla
        //  no debemos liberar una mesa que aún tiene comensales/orden en curso.)
        var tableIds = vt.Tables.Select(t => t.TableId).ToList();
        var tablesWithActiveOrders = await _context.Orders
            .Where(o => o.TableId.HasValue && tableIds.Contains(o.TableId.Value)
                && o.Status != Domain.Enums.OrderStatus.Completed
                && o.Status != Domain.Enums.OrderStatus.Cancelled)
            .Select(o => o.TableId!.Value)
            .Distinct()
            .ToListAsync();
        var tables = await _context.Tables.Where(t => tableIds.Contains(t.Id)).ToListAsync();
        int released = 0;
        foreach (var table in tables)
        {
            if (tablesWithActiveOrders.Contains(table.Id))
            {
                _logger.LogInformation($"🗑️ Mesa #{table.TableNumber} (ID: {table.Id}) NO liberada — conserva Occupied (tiene órdenes activas)");
                continue;
            }
            table.Status = Domain.Enums.TableStatus.Available;
            released++;
            _logger.LogInformation($"🗑️ Mesa #{table.TableNumber} (ID: {table.Id}) liberada (Available)");
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation($"🗑️ Mesa virtual ID {id} desactivada y {released} mesas liberadas");
        return Ok(new { message = "Mesa virtual desactivada", id = vt.Id, tablesReleased = released });
    }

    /// <summary>
    /// VT-PAY — Cobro unificado de la mesa virtual: UN solo pago (comprobante único) bajo la
    /// mesa pagadora que cubre TODAS las órdenes activas del grupo. Marca todas como Completed,
    /// pasa las mesas a Cleaning y cierra la mesa virtual.
    /// </summary>
    [HttpPost("{id}/pay")]
    public async Task<IActionResult> PayUnified(int id, [FromBody] PayVirtualTableDto dto)
    {
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var vt = await _context.VirtualTables
                .Include(v => v.Tables)
                .FirstOrDefaultAsync(v => v.Id == id && v.IsActive);
            if (vt == null)
                return NotFound(new { error = "Mesa virtual no encontrada o ya cerrada" });

            var tableIds = vt.Tables.Select(t => t.TableId).ToList();
            var payerTableId = vt.PayerTableId ?? tableIds.FirstOrDefault();

            // Órdenes activas (no completadas/canceladas) de todas las mesas del grupo
            var orders = await _context.Orders
                .Where(o => o.TableId.HasValue && tableIds.Contains(o.TableId.Value)
                    && o.Status != Domain.Enums.OrderStatus.Completed
                    && o.Status != Domain.Enums.OrderStatus.Cancelled)
                .ToListAsync();

            if (orders.Count == 0)
                return BadRequest(new { error = "La mesa virtual no tiene órdenes pendientes de cobro." });

            // Validación fiscal (igual que el cobro por orden): comprobante exige RNC + razón social
            if (dto.RequiresFiscalReceipt && (string.IsNullOrWhiteSpace(dto.RNC) || string.IsNullOrWhiteSpace(dto.BusinessName)))
                return BadRequest(new { error = "Comprobante fiscal requiere RNC y razón social." });

            // Total combinado = suma de los totales por orden (cada uno ya con ITBIS 18% + propina 10%)
            decimal groupSubtotal = orders.Sum(o => o.Subtotal);
            decimal groupTax = orders.Sum(o => o.Tax);
            decimal groupTip = orders.Sum(o => o.Tip);
            decimal groupTotal = orders.Sum(o => o.Total);

            // Orden de la mesa pagadora — ancla del comprobante único
            var payerOrder = orders.FirstOrDefault(o => o.TableId == payerTableId) ?? orders.First();

            // UN solo Payment (comprobante único) por el total del grupo
            var payment = new Payment
            {
                OrderId = payerOrder.Id,
                Method = dto.PaymentMethod ?? "Cash",
                Amount = groupSubtotal + groupTax,
                TipAmount = groupTip,
                TipPercentage = groupSubtotal > 0 ? (groupTip / groupSubtotal) * 100 : 0,
                TotalAmount = groupTotal,
                ProcessedByWaiterId = dto.ProcessedByWaiterId,
                BillSplitType = "VirtualTableUnified",
                RequiresFiscalReceipt = dto.RequiresFiscalReceipt,
                RNC = dto.RequiresFiscalReceipt ? dto.RNC : null,
                BusinessName = dto.RequiresFiscalReceipt ? dto.BusinessName : null,
                Status = Domain.Enums.PaymentStatus.Completed,
                CompletedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
            };
            _context.Payments.Add(payment);

            // Marcar TODAS las órdenes del grupo como Completed
            foreach (var o in orders)
            {
                o.Status = Domain.Enums.OrderStatus.Completed;
                o.CompletedAt = DateTime.UtcNow;
                o.UpdatedAt = DateTime.UtcNow;
            }

            // Liberar mesas del grupo (Cleaning) y cerrar la mesa virtual
            var tables = await _context.Tables.Where(t => tableIds.Contains(t.Id)).ToListAsync();
            foreach (var t in tables)
                t.Status = Domain.Enums.TableStatus.Cleaning;
            vt.IsActive = false;
            vt.DeactivatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            var payerNumber = tables.FirstOrDefault(t => t.Id == payerTableId)?.TableNumber;
            _logger.LogInformation($"💰 Cobro unificado VT {vt.Id}: {orders.Count} órdenes, total {groupTotal:0.00}, pagadora mesa #{payerNumber}");
            return Ok(new
            {
                message = "Mesa virtual cobrada",
                virtualTableId = vt.Id,
                paymentId = payment.Id,
                payerTableId,
                payerTableNumber = payerNumber,
                ordersPaid = orders.Count,
                subtotal = groupSubtotal,
                tax = groupTax,
                tip = groupTip,
                total = groupTotal,
                method = payment.Method,
                requiresFiscalReceipt = payment.RequiresFiscalReceipt
            });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Error en cobro unificado de mesa virtual {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
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
    /// <summary>Mesa designada para el pago general (cobro unificado). Debe ser una de TableIds.</summary>
    public int? PayerTableId { get; set; }
}

public class PayVirtualTableDto
{
    public string? PaymentMethod { get; set; }   // Cash, Card, Transfer, Mixed
    public int? ProcessedByWaiterId { get; set; }
    public bool RequiresFiscalReceipt { get; set; } = false;
    public string? RNC { get; set; }
    public string? BusinessName { get; set; }
}
