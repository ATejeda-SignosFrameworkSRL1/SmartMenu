using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Domain.Entities;
using SmartMenu.API.Hubs;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
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

    // S1.3 — quien procesa el pago siempre es el usuario autenticado.
    // Admin/Manager pueden hacer override pasando dto.WaiterId (registrar pago a otro mesero).
    // Cualquier otro rol: se ignora dto.WaiterId, se usa el del JWT.
    private int? GetProcessorIdFromContext(int? dtoWaiterId)
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var isPrivileged = role == "Admin" || role == "Manager";
        if (isPrivileged && dtoWaiterId.HasValue && dtoWaiterId.Value > 0)
            return dtoWaiterId.Value;
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(sub, out var id) ? id : null;
    }

    /// <summary>
    /// Crear nuevo pago
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreatePayment([FromBody] CreatePaymentDto dto)
    {
        // S1.3 — usar identidad del JWT salvo override Admin/Manager.
        var processorId = GetProcessorIdFromContext(dto.WaiterId);
        if (processorId == null) return Unauthorized(new { error = "Usuario no identificado" });

        // S1.2 — multi-table write protegido por transacción explícita.
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var order = await _context.Orders
                .Include(o => o.Items)
                .Include(o => o.Table)
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId);

            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });

            if (order.Status == Domain.Enums.OrderStatus.Completed)
                return BadRequest(new { error = "Esta orden ya está pagada" });

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

            var payment = new Payment
            {
                OrderId = dto.OrderId,
                Method = dto.PaymentMethod,
                Amount = dto.Amount,
                TipAmount = tipAmount,
                TipPercentage = tipPercentage,
                TotalAmount = totalAmount,
                ProcessedByWaiterId = processorId,
                TransactionId = dto.TransactionId,
                Status = Domain.Enums.PaymentStatus.Completed,
                CompletedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                BillSplitType = dto.BillSplitType,
                SplitPartIndex = dto.SplitPartIndex
            };

            _context.Payments.Add(payment);

            var totalPaidBefore = await _context.Payments.Where(p => p.OrderId == dto.OrderId).SumAsync(p => p.Amount);
            var totalPaidNow = totalPaidBefore + payment.Amount;
            if (totalPaidNow >= order.Total)
            {
                order.Status = Domain.Enums.OrderStatus.Completed;
                order.CompletedAt = DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;
            }

            if (order.Table != null && order.Table.Status != Domain.Enums.TableStatus.Billing)
                order.Table.Status = Domain.Enums.TableStatus.Billing;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            _logger.LogInformation("Payment {PaymentId} created for Order {OrderId} by processor {ProcessorId}, Method: {Method}, Amount: {Amount}",
                payment.Id, dto.OrderId, processorId, dto.PaymentMethod, dto.Amount);

            // S5.1 — push a cashier-app (y cualquier suscriptor) para refrescar caja sin polling.
            await _hub.Clients.All.SendAsync("PaymentRegistered", new
            {
                paymentId = payment.Id,
                orderId = payment.OrderId,
                orderNumber = order.OrderNumber,
                method = payment.Method,
                amount = payment.Amount,
                tipAmount = payment.TipAmount,
                totalAmount = payment.TotalAmount,
                completedAt = payment.CompletedAt
            });

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
            await tx.RollbackAsync();
            _logger.LogError(ex, "Error creating payment — rolled back");
            return StatusCode(500, new { error = "Error al procesar pago" });
        }
    }

    /// <summary>
    /// S3.3 — Receipt para el cliente: agrega pagos de una orden completada y devuelve
    /// los datos del comprobante (orderNumber, totales, propina, método, fiscal data).
    /// Sin auth: el cliente final no tiene JWT — solo conoce el orderId desde su QR session.
    /// </summary>
    [HttpGet("by-order/{orderId:int}/receipt")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReceiptByOrder(int orderId)
    {
        var order = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.Dish)
            .Include(o => o.Payments)
            .Include(o => o.Table)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) return NotFound(new { error = "Orden no encontrada" });

        var paid = order.Payments.Where(p => p.Status == Domain.Enums.PaymentStatus.Completed).ToList();
        if (paid.Count == 0)
            return NotFound(new { error = "La orden todavía no tiene cobro registrado" });

        var totalPaid = paid.Sum(p => p.Amount);
        var totalTips = paid.Sum(p => p.TipAmount);
        var methods = paid.Select(p => p.Method).Distinct().ToList();
        var first = paid.OrderBy(p => p.CompletedAt).First();
        var requiresFiscal = paid.Any(p => p.RequiresFiscalReceipt);
        var rnc = paid.FirstOrDefault(p => !string.IsNullOrEmpty(p.RNC))?.RNC;
        var businessName = paid.FirstOrDefault(p => !string.IsNullOrEmpty(p.BusinessName))?.BusinessName;

        return Ok(new
        {
            paymentId = first.Id,
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            tableNumber = order.Table?.TableNumber,
            customerName = order.CustomerName,
            paidAt = paid.Max(p => p.CompletedAt),
            subtotal = order.Subtotal,
            tax = order.Tax,
            tipLegal = order.Tip,
            tipExtra = totalTips,
            total = totalPaid + totalTips,
            methods,
            requiresFiscalReceipt = requiresFiscal,
            rnc,
            businessName,
            items = order.Items.Select(i => new
            {
                dishName = i.Dish?.Name ?? "—",
                quantity = i.Quantity,
                unitPrice = i.UnitPrice,
                subtotal = i.Subtotal
            }).ToList()
        });
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
        // S1.3 — processor del cobro siempre desde JWT (Admin puede override con dto.WaiterId).
        var processorId = GetProcessorIdFromContext(dto.WaiterId);
        if (processorId == null) return Unauthorized(new { error = "Usuario no identificado" });

        // S1.2 — multi-table write protegido por transacción explícita (Order + Payments + Table).
        await using var tx = await _context.Database.BeginTransactionAsync();
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

            // S1.4 — Fiscal RNC sync Order↔Payment. Si Order pidió comprobante O dto lo pide, captura ambos
            // valores y valida que RNC + BusinessName estén presentes. No se permite emitir sin esos datos.
            var requiresReceipt = dto.RequiresFiscalReceipt || order.ClientRequiresFiscalReceipt;
            var effectiveRnc = string.IsNullOrWhiteSpace(dto.RNC) ? order.ClientRNC : dto.RNC;
            var effectiveBusinessName = string.IsNullOrWhiteSpace(dto.BusinessName) ? order.ClientBusinessName : dto.BusinessName;
            if (requiresReceipt && (string.IsNullOrWhiteSpace(effectiveRnc) || string.IsNullOrWhiteSpace(effectiveBusinessName)))
                return BadRequest(new { error = "Comprobante fiscal requiere RNC y razón social. Captura los datos del cliente antes de cobrar." });

            // Eliminar pagos previos no completados de esta orden
            var existingPending = _context.Payments
                .Where(p => p.OrderId == dto.OrderId && p.Status != Domain.Enums.PaymentStatus.Completed);
            _context.Payments.RemoveRange(existingPending);

            decimal totalPaid = 0;

            if (dto.SubPayments != null && dto.SubPayments.Count > 0)
            {
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
                        ProcessedByWaiterId = processorId,
                        BillSplitType = dto.BillSplitType,
                        SplitPartIndex = sub.SplitPartIndex,
                        RequiresFiscalReceipt = requiresReceipt,
                        RNC = effectiveRnc,
                        BusinessName = effectiveBusinessName,
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
                    ProcessedByWaiterId = processorId,
                    BillSplitType = dto.BillSplitType,
                    SplitPartIndex = dto.SplitPartIndex,
                    RequiresFiscalReceipt = requiresReceipt,
                    RNC = effectiveRnc,
                    BusinessName = effectiveBusinessName,
                    Status = Domain.Enums.PaymentStatus.Completed,
                    CompletedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                };
                _context.Payments.Add(payment);
                totalPaid = baseAmount;
            }

            // S4.6 — Split bill validation: la suma de subPayments debe igualar order.Total.
            // Tolerancia de 1 centavo para rounding. Sin esto, una orden podía marcarse
            // Completed con deuda silenciosa (frontend mete totales mal cuadrados).
            if (Math.Abs(totalPaid - order.Total) > 0.01m)
            {
                throw new InvalidOperationException(
                    $"El monto cobrado ({totalPaid:0.00}) no coincide con el total de la orden ({order.Total:0.00}). Diferencia: {(order.Total - totalPaid):0.00}.");
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
            await tx.CommitAsync();

            _logger.LogInformation("Payment collected by processor {ProcessorId} for order {OrderId}, table set to Cleaning", processorId, dto.OrderId);
            return Ok(new { message = "Cobro registrado. Mesa en limpieza.", tableId = order.TableId });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Error collecting payment for order {OrderId} — rolled back", dto.OrderId);
            return StatusCode(500, new { error = "Error al registrar cobro" });
        }
    }

    /// <summary>
    /// Validar RNC contra la API pública de la DGII (datos.gob.do).
    /// Devuelve el nombre de la empresa si el RNC es válido.
    /// </summary>
    [HttpGet("validate-rnc/{rnc}")]
    [AllowAnonymous]
    [EnableRateLimiting("rnc")]
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
    public async Task<IActionResult> ListPayments(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? page = null,
        [FromQuery] int pageSize = 100)
    {
        var fromDate = (from ?? DateTime.UtcNow.Date).Date;
        var toDate = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var baseQuery = _context.Payments
            .AsNoTracking()
            .Include(p => p.Order).ThenInclude(o => o!.Table)
            .Include(p => p.ProcessedByWaiter)
            .Where(p => p.CompletedAt >= fromDate && p.CompletedAt < toDate && p.Status == Domain.Enums.PaymentStatus.Completed)
            .OrderByDescending(p => p.CompletedAt);

        // Summary se calcula SIEMPRE sobre el set filtrado completo (no por página).
        var summaryRaw = await baseQuery
            .Select(p => new { p.Method, p.Amount, p.TipAmount, p.TotalAmount, p.RequiresFiscalReceipt })
            .ToListAsync();
        var summary = new
        {
            TotalAmount = summaryRaw.Sum(p => p.Amount),
            TotalTips = summaryRaw.Sum(p => p.TipAmount),
            TotalWithTips = summaryRaw.Sum(p => p.TotalAmount),
            Count = summaryRaw.Count,
            ByCash = summaryRaw.Where(p => p.Method == "Cash").Sum(p => p.TotalAmount),
            ByCard = summaryRaw.Where(p => p.Method == "Card").Sum(p => p.TotalAmount),
            ByTransfer = summaryRaw.Where(p => p.Method == "Transfer").Sum(p => p.TotalAmount),
            ByMixed = summaryRaw.Where(p => p.Method == "Mixed").Sum(p => p.TotalAmount),
            FiscalCount = summaryRaw.Count(p => p.RequiresFiscalReceipt)
        };

        var projection = baseQuery.Select(p => new
        {
            p.Id, p.OrderId,
            OrderNumber = p.Order != null ? p.Order.OrderNumber : "",
            TableNumber = p.Order != null && p.Order.Table != null ? p.Order.Table.TableNumber : 0,
            p.Method, p.Amount, p.TipAmount, p.TotalAmount, p.CompletedAt,
            p.RequiresFiscalReceipt, p.RNC, p.BusinessName,
            WaiterName = p.ProcessedByWaiter != null
                ? p.ProcessedByWaiter.FirstName + " " + p.ProcessedByWaiter.LastName
                : null
        });

        // Legacy: sin ?page devuelve la lista completa (compat con reportes EOD existentes).
        if (page is null)
        {
            var all = await projection.ToListAsync();
            return Ok(new { from = fromDate, to = toDate.AddDays(-1), summary, payments = all });
        }

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 100;
        if (pageSize > 500) pageSize = 500;
        var pageItems = await projection.Skip((page.Value - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new
        {
            from = fromDate,
            to = toDate.AddDays(-1),
            summary,
            payments = pageItems,
            page = page.Value,
            pageSize,
            total = summary.Count
        });
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
