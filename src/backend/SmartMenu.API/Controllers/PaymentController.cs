using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Entities;
using SmartMenu.API.Hubs;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PaymentController> _logger;
    private readonly IHubContext<OrderHub> _hub;

    public PaymentController(ApplicationDbContext context, ILogger<PaymentController> logger, IHubContext<OrderHub> hub)
    {
        _context = context;
        _logger = logger;
        _hub = hub;
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

            // Completar orden cuando el total pagado alcanza el total
            var totalPaidBefore = await _context.Payments.Where(p => p.OrderId == dto.OrderId).SumAsync(p => p.Amount);
            var totalPaidNow = totalPaidBefore + payment.Amount;
            if (totalPaidNow >= order.Total)
            {
                order.Status = Domain.Enums.OrderStatus.Completed;
                order.CompletedAt = DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;
            }

            // Mesa pasa a "Por Cobrar" (Billing): el cliente inició el pago, el mesero aún debe recolectarlo
            if (order.Table != null && order.Table.Status != Domain.Enums.TableStatus.Billing)
                order.Table.Status = Domain.Enums.TableStatus.Billing;

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
    /// Solicitar cuenta: el cliente abre la pantalla de pago, la mesa pasa a "Por Cobrar" (Billing).
    /// Ahora acepta las preferencias del cliente (método de pago y propina).
    /// </summary>
    [HttpPost("request-billing/{orderId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RequestBilling(int orderId, [FromBody] RequestBillingDto? dto)
    {
        try
        {
            var order = await _context.Orders
                .Include(o => o.Table)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });

            if (order.Table != null && order.Table.Status == Domain.Enums.TableStatus.Occupied)
                order.Table.Status = Domain.Enums.TableStatus.Billing;

            // Guardar preferencias del cliente si se enviaron
            if (dto != null)
            {
                if (!string.IsNullOrEmpty(dto.PaymentMethod))
                    order.ClientRequestedPaymentMethod = dto.PaymentMethod;
                if (dto.TipPercentage > 0)
                    order.ClientTipPercentage = dto.TipPercentage;
                if (dto.TipAmount > 0)
                    order.ClientTipAmount = dto.TipAmount;
                order.ClientRequiresFiscalReceipt = dto.RequiresFiscalReceipt;
                if (!string.IsNullOrEmpty(dto.RNC))
                    order.ClientRNC = dto.RNC;
                if (!string.IsNullOrEmpty(dto.BusinessName))
                    order.ClientBusinessName = dto.BusinessName;
            }

            await _context.SaveChangesAsync();

            // Solo notificar al mesero vía SignalR cuando el cliente envía sus preferencias
            // de pago (método de pago elegido). La primera llamada automática al abrir la
            // pantalla no tiene PaymentMethod y solo marca la mesa como Billing.
            bool hasPaymentPreferences = dto != null && !string.IsNullOrEmpty(dto.PaymentMethod);
            if (hasPaymentPreferences)
            {
                var payload = new
                {
                    orderId = order.Id,
                    orderNumber = order.OrderNumber,
                    tableNumber = order.Table?.TableNumber ?? 0,
                    paymentMethod = order.ClientRequestedPaymentMethod ?? "Cash",
                    tipPercentage = order.ClientTipPercentage,
                    tipAmount = order.ClientTipAmount,
                    total = order.Total,
                    message = $"💳 Mesa {order.Table?.TableNumber} solicita la cuenta"
                };

                if (order.AssignedWaiterId.HasValue)
                    await _hub.Clients.Group($"waiter_{order.AssignedWaiterId.Value}").SendAsync("BillingRequested", payload);
                else
                    await _hub.Clients.All.SendAsync("BillingRequested", payload);
            }

            return Ok(new
            {
                message = "Mesa en proceso de cobro",
                tableStatus = "Billing",
                paymentMethod = order.ClientRequestedPaymentMethod,
                tipPercentage = order.ClientTipPercentage,
                tipAmount = order.ClientTipAmount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting billing for order {OrderId}", orderId);
            return StatusCode(500, new { error = "Error al solicitar cuenta" });
        }
    }

    /// <summary>
    /// Cobrar: el mesero registra el pago con todos los detalles (método, propina, división de cuenta).
    /// Soporta pagos mixtos (múltiples subpagos) y división de cuenta.
    /// </summary>
    [HttpPost("collect")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CollectPayment([FromBody] CollectPaymentDto dto)
    {
        try
        {
            var order = await _context.Orders
                .Include(o => o.Table)
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId);

            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });

            if (order.Status == Domain.Enums.OrderStatus.Pending)
                return BadRequest(new { error = "La orden aún no ha sido servida" });

            // Eliminar pagos previos no completados de esta orden (si el mesero está rehaciendo el cobro)
            var existingPending = _context.Payments
                .Where(p => p.OrderId == dto.OrderId && p.Status != Domain.Enums.PaymentStatus.Completed);
            _context.Payments.RemoveRange(existingPending);

            decimal totalPaid = 0;

            if (dto.SubPayments != null && dto.SubPayments.Count > 0)
            {
                // Pago mixto o split: varios subpagos
                foreach (var sub in dto.SubPayments)
                {
                    decimal subTip = sub.TipAmount;
                    var p = new Payment
                    {
                        OrderId = dto.OrderId,
                        Method = sub.Method,
                        Amount = sub.Amount,
                        TipAmount = subTip,
                        TipPercentage = sub.Amount > 0 ? (subTip / sub.Amount) * 100 : 0,
                        TotalAmount = sub.Amount + subTip,
                        ProcessedByWaiterId = dto.WaiterId,
                        BillSplitType = dto.BillSplitType,
                        SplitPartIndex = sub.SplitPartIndex,
                        RequiresFiscalReceipt = dto.RequiresFiscalReceipt || order.ClientRequiresFiscalReceipt,
                        RNC = dto.RNC ?? order.ClientRNC,
                        BusinessName = dto.BusinessName ?? order.ClientBusinessName,
                        Status = Domain.Enums.PaymentStatus.Completed,
                        CompletedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow,
                    };
                    _context.Payments.Add(p);
                    totalPaid += sub.Amount;
                }
            }
            else
            {
                // Pago simple
                string method = dto.PaymentMethod ?? order.ClientRequestedPaymentMethod ?? "Cash";
                decimal tipPct = dto.TipPercentage > 0 ? dto.TipPercentage : order.ClientTipPercentage;
                decimal baseAmount = dto.Amount > 0 ? dto.Amount : order.Total;
                decimal tipAmt = dto.TipAmount > 0 ? dto.TipAmount
                    : (dto.TipPercentage > 0 ? baseAmount * (tipPct / 100) : order.ClientTipAmount);

                var payment = new Payment
                {
                    OrderId = dto.OrderId,
                    Method = method,
                    Amount = baseAmount,
                    TipAmount = tipAmt,
                    TipPercentage = tipPct,
                    TotalAmount = baseAmount + tipAmt,
                    ProcessedByWaiterId = dto.WaiterId,
                    BillSplitType = dto.BillSplitType,
                    SplitPartIndex = dto.SplitPartIndex,
                    RequiresFiscalReceipt = dto.RequiresFiscalReceipt || order.ClientRequiresFiscalReceipt,
                    RNC = dto.RNC ?? order.ClientRNC,
                    BusinessName = dto.BusinessName ?? order.ClientBusinessName,
                    Status = Domain.Enums.PaymentStatus.Completed,
                    CompletedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                };
                _context.Payments.Add(payment);
                totalPaid = baseAmount;
            }

            // Completar la orden
            if (order.Status != Domain.Enums.OrderStatus.Completed)
            {
                order.Status = Domain.Enums.OrderStatus.Completed;
                order.CompletedAt = DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;
            }

            // Mesa a Cleaning
            if (order.Table != null)
                order.Table.Status = Domain.Enums.TableStatus.Cleaning;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Payment collected by waiter {WaiterId} for order {OrderId}, table set to Cleaning", dto.WaiterId, dto.OrderId);
            return Ok(new { message = "Cobro registrado. Mesa en limpieza.", tableId = order.TableId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error collecting payment for order {OrderId}", dto.OrderId);
            return StatusCode(500, new { error = "Error al registrar cobro" });
        }
    }

    /// <summary>
    /// Validar RNC contra la API pública de la DGII (datos.gob.do).
    /// Devuelve el nombre de la empresa si el RNC es válido.
    /// </summary>
    [HttpGet("validate-rnc/{rnc}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ValidateRnc(string rnc)
    {
        try
        {
            var cleanRnc = rnc.Replace("-", "").Trim();
            using var http = new HttpClient();
            http.DefaultRequestHeaders.Add("Accept", "application/json");
            http.Timeout = TimeSpan.FromSeconds(10);

            var response = await http.GetAsync($"https://api.digital.gob.do/v3/rncs?rnc={cleanRnc}");

            if (!response.IsSuccessStatusCode)
                return NotFound(new { error = "RNC no encontrado en la DGII" });

            var json = await response.Content.ReadAsStringAsync();
            // La API devuelve { data: [{ rnc, nombre, ... }] }
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var dataArr = doc.RootElement.GetProperty("data");
            if (dataArr.GetArrayLength() == 0)
                return NotFound(new { error = "RNC no encontrado en la DGII" });

            var first = dataArr[0];
            var nombre = first.TryGetProperty("nombre", out var n) ? n.GetString() : null;
            var rncVal = first.TryGetProperty("rnc", out var r) ? r.GetString() : cleanRnc;

            if (string.IsNullOrEmpty(nombre))
                return NotFound(new { error = "RNC no tiene nombre registrado" });

            return Ok(new { rnc = rncVal, businessName = nombre });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating RNC {Rnc}", rnc);
            return StatusCode(500, new { error = "Error al consultar la DGII" });
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
            .Include(p => p.ProcessedByWaiter)
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
                p.CompletedAt,
                p.RequiresFiscalReceipt,
                p.RNC,
                p.BusinessName,
                WaiterName = p.ProcessedByWaiter != null
                    ? p.ProcessedByWaiter.FirstName + " " + p.ProcessedByWaiter.LastName
                    : null
            })
            .ToListAsync();

        var summary = new
        {
            TotalAmount = list.Sum(p => p.Amount),
            TotalTips = list.Sum(p => p.TipAmount),
            TotalWithTips = list.Sum(p => p.TotalAmount),
            Count = list.Count,
            ByCash = list.Where(p => p.Method == "Cash").Sum(p => p.TotalAmount),
            ByCard = list.Where(p => p.Method == "Card").Sum(p => p.TotalAmount),
            ByTransfer = list.Where(p => p.Method == "Transfer").Sum(p => p.TotalAmount),
            ByMixed = list.Where(p => p.Method == "Mixed").Sum(p => p.TotalAmount),
            FiscalCount = list.Count(p => p.RequiresFiscalReceipt)
        };
        return Ok(new { from = fromDate, to = toDate.AddDays(-1), summary, payments = list });
    }

    /// <summary>
    /// Agregar o actualizar comprobante fiscal (NCF) a un pago existente
    /// </summary>
    [HttpPatch("{id}/fiscal")]
    public async Task<IActionResult> UpdateFiscalReceipt(int id, [FromBody] UpdateFiscalReceiptDto dto)
    {
        var payment = await _context.Payments.FindAsync(id);
        if (payment == null)
            return NotFound(new { error = "Pago no encontrado" });

        payment.RequiresFiscalReceipt = true;
        payment.RNC = dto.RNC;
        payment.BusinessName = dto.BusinessName;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Comprobante fiscal registrado", rnc = payment.RNC, businessName = payment.BusinessName });
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
    /// <summary>Método de pago principal (Cash, Card, Transfer, Mixed).</summary>
    public string? PaymentMethod { get; set; }
    public decimal Amount { get; set; } = 0;
    public decimal TipAmount { get; set; } = 0;
    public decimal TipPercentage { get; set; } = 0;
    public string? BillSplitType { get; set; }
    public int? SplitPartIndex { get; set; }
    /// <summary>Para pagos mixtos o split: lista de subpagos.</summary>
    public List<SubPaymentDto>? SubPayments { get; set; }
    /// <summary>Datos fiscales confirmados por el mesero.</summary>
    public bool RequiresFiscalReceipt { get; set; } = false;
    public string? RNC { get; set; }
    public string? BusinessName { get; set; }
}

/// <summary>Un subpago dentro de un pago mixto o divisón de cuenta.</summary>
public class SubPaymentDto
{
    public string Method { get; set; } = "Cash";
    public decimal Amount { get; set; }
    public decimal TipAmount { get; set; } = 0;
    public int? SplitPartIndex { get; set; }
}

/// <summary>DTO para solicitar cuenta con preferencias del cliente.</summary>
public class RequestBillingDto
{
    public string? PaymentMethod { get; set; }
    public decimal TipPercentage { get; set; } = 0;
    public decimal TipAmount { get; set; } = 0;
    public bool RequiresFiscalReceipt { get; set; } = false;
    public string? RNC { get; set; }
    public string? BusinessName { get; set; }
}

/// <summary>DTO para actualizar comprobante fiscal en un pago existente.</summary>
public class UpdateFiscalReceiptDto
{
    public string RNC { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
}
