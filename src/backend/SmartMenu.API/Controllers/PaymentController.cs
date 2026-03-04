using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Entities;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PaymentController> _logger;

    public PaymentController(ApplicationDbContext context, ILogger<PaymentController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Crear nuevo pago
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreatePayment([FromBody] CreatePaymentDto dto)
    {
        try
        {
            // Verificar que la orden existe e incluir la mesa
            var order = await _context.Orders
                .Include(o => o.Items)
                .Include(o => o.Table)
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId);

            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });

            if (order.Status == Domain.Enums.OrderStatus.Completed)
                return BadRequest(new { error = "Esta orden ya está pagada" });

            // Calcular propina
            decimal tipAmount = 0;
            decimal tipPercentage = 0;
            
            if (dto.TipPercentage > 0)
            {
                tipPercentage = dto.TipPercentage;
                tipAmount = dto.Amount * (dto.TipPercentage / 100);
            }
            else if (dto.TipAmount > 0)
            {
                tipAmount = dto.TipAmount;
                tipPercentage = (tipAmount / dto.Amount) * 100;
            }

            decimal totalAmount = dto.Amount + tipAmount;

            // Crear pago (soporta división de cuenta: varios pagos suman al total)
            var payment = new Payment
            {
                OrderId = dto.OrderId,
                Method = dto.PaymentMethod,
                Amount = dto.Amount,
                TipAmount = tipAmount,
                TipPercentage = tipPercentage,
                TotalAmount = totalAmount,
                ProcessedByWaiterId = dto.WaiterId,
                TransactionId = dto.TransactionId,
                Status = Domain.Enums.PaymentStatus.Completed,
                CompletedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                BillSplitType = dto.BillSplitType,
                SplitPartIndex = dto.SplitPartIndex
            };

            _context.Payments.Add(payment);

            // Completar orden y mesa solo cuando el total pagado alcanza el total (incluye este pago recién añadido, aún no guardado)
            var totalPaidBefore = await _context.Payments.Where(p => p.OrderId == dto.OrderId).SumAsync(p => p.Amount);
            var totalPaidNow = totalPaidBefore + payment.Amount;
            if (totalPaidNow >= order.Total)
            {
                order.Status = Domain.Enums.OrderStatus.Completed;
                order.CompletedAt = DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;
                if (order.Table != null)
                    order.Table.Status = Domain.Enums.TableStatus.Cleaning;
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Payment created for Order {OrderId}, Method: {Method}, Amount: {Amount}",
                dto.OrderId, dto.PaymentMethod, dto.Amount);

            return CreatedAtAction(nameof(GetPayment), new { id = payment.Id }, new
            {
                payment.Id,
                payment.OrderId,
                PaymentMethod = payment.Method,
                payment.Amount,
                Status = payment.Status.ToString(),
                ProcessedAt = payment.CompletedAt,
                OrderNumber = order.OrderNumber
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating payment");
            return StatusCode(500, new { error = "Error al procesar pago" });
        }
    }

    /// <summary>
    /// Obtener pago por ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPayment(int id)
    {
        try
        {
            var payment = await _context.Payments
                .Include(p => p.Order)
                .Where(p => p.Id == id)
                .Select(p => new
                {
                    p.Id,
                    p.OrderId,
                    OrderNumber = p.Order.OrderNumber,
                    PaymentMethod = p.Method,
                    p.Amount,
                    p.TransactionId,
                    Status = p.Status.ToString(),
                    ProcessedAt = p.CompletedAt,
                    p.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (payment == null)
                return NotFound(new { message = "Pago no encontrado" });

            return Ok(payment);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting payment {PaymentId}", id);
            return StatusCode(500, new { error = "Error al obtener pago" });
        }
    }

    /// <summary>
    /// Obtener pagos por orden
    /// </summary>
    [HttpGet("order/{orderId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPaymentsByOrder(int orderId)
    {
        try
        {
            var payments = await _context.Payments
                .Where(p => p.OrderId == orderId)
                .Select(p => new
                {
                    p.Id,
                    PaymentMethod = p.Method,
                    p.Amount,
                    Status = p.Status.ToString(),
                    ProcessedAt = p.CompletedAt
                })
                .ToListAsync();

            return Ok(payments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting payments for order {OrderId}", orderId);
            return StatusCode(500, new { error = "Error al obtener pagos" });
        }
    }

    /// <summary>
    /// Cobrar: el mesero registra que recolectó el pago que ya hizo el cliente.
    /// Asigna el pago al mesero (ventas + propina), pone la mesa en estado Limpieza.
    /// </summary>
    [HttpPost("collect")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CollectPayment([FromBody] CollectPaymentDto dto)
    {
        try
        {
            var payment = await _context.Payments
                .Include(p => p.Order)
                .ThenInclude(o => o!.Table)
                .FirstOrDefaultAsync(p => p.OrderId == dto.OrderId);

            if (payment == null || payment.Order == null)
                return NotFound(new { error = "Pago u orden no encontrada" });

            if (payment.Order.Status != Domain.Enums.OrderStatus.Completed)
                return BadRequest(new { error = "La orden aún no está pagada por el cliente" });

            payment.ProcessedByWaiterId = dto.WaiterId;
            payment.Order.Table.Status = Domain.Enums.TableStatus.Cleaning;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Payment collected by waiter {WaiterId} for order {OrderId}, table set to Cleaning", dto.WaiterId, dto.OrderId);
            return Ok(new { message = "Cobro registrado. Mesa en limpieza.", tableId = payment.Order.TableId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error collecting payment for order {OrderId}", dto.OrderId);
            return StatusCode(500, new { error = "Error al registrar cobro" });
        }
    }

    /// <summary>
    /// Listar pagos en un rango de fechas (para cajero/admin)
    /// </summary>
    [HttpGet("list")]
    public async Task<IActionResult> ListPayments([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var fromDate = (from ?? DateTime.UtcNow.Date).Date;
        var toDate = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);
        var list = await _context.Payments
            .Include(p => p.Order)
            .ThenInclude(o => o!.Table)
            .Where(p => p.CompletedAt >= fromDate && p.CompletedAt < toDate && p.Status == Domain.Enums.PaymentStatus.Completed)
            .OrderByDescending(p => p.CompletedAt)
            .Select(p => new
            {
                p.Id,
                p.OrderId,
                OrderNumber = p.Order != null ? p.Order.OrderNumber : "",
                TableNumber = p.Order != null && p.Order.Table != null ? p.Order.Table.TableNumber : 0,
                p.Method,
                p.Amount,
                p.TipAmount,
                p.TotalAmount,
                p.CompletedAt
            })
            .ToListAsync();
        var summary = new
        {
            TotalAmount = list.Sum(p => p.Amount),
            TotalTips = list.Sum(p => p.TipAmount),
            Count = list.Count
        };
        return Ok(new { from = fromDate, to = toDate.AddDays(-1), summary, payments = list });
    }

    /// <summary>
    /// Obtener estadísticas de ventas y propinas de un mesero
    /// </summary>
    [HttpGet("waiter-stats/{waiterId}")]
    public async Task<IActionResult> GetWaiterStats(int waiterId, [FromQuery] DateTime? date)
    {
        try
        {
            var targetDate = date ?? DateTime.UtcNow.Date;
            var nextDay = targetDate.AddDays(1);

            var payments = await _context.Payments
                .Where(p => p.ProcessedByWaiterId == waiterId 
                    && p.CompletedAt >= targetDate 
                    && p.CompletedAt < nextDay
                    && p.Status == Domain.Enums.PaymentStatus.Completed)
                .ToListAsync();

            var stats = new
            {
                TotalSales = payments.Sum(p => p.Amount),
                TotalTips = payments.Sum(p => p.TipAmount),
                TotalAmount = payments.Sum(p => p.TotalAmount),
                TransactionCount = payments.Count,
                Date = targetDate
            };

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting waiter stats for {WaiterId}", waiterId);
            return StatusCode(500, new { error = "Error al obtener estadísticas" });
        }
    }
}

/// <summary>
/// DTO para crear pago
/// </summary>
public class CreatePaymentDto
{
    public int OrderId { get; set; }
    public string PaymentMethod { get; set; } = string.Empty; // Cash, Card, Transfer
    public decimal Amount { get; set; }
    public decimal TipAmount { get; set; } = 0;
    public decimal TipPercentage { get; set; } = 0;
    public int? WaiterId { get; set; }
    public string? TransactionId { get; set; }
    public string? BillSplitType { get; set; } // None, ByTime, ByComensal, Proportional, ByCategory
    public int? SplitPartIndex { get; set; }
}

public class CollectPaymentDto
{
    public int OrderId { get; set; }
    public int WaiterId { get; set; }
}
