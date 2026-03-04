using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.API.Hubs;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrderController> _logger;
    private readonly IHubContext<KitchenHub> _kitchenHub;

    public OrderController(IOrderService orderService, ILogger<OrderController> logger, IHubContext<KitchenHub> kitchenHub)
    {
        _orderService = orderService;
        _logger = logger;
        _kitchenHub = kitchenHub;
    }

    private static string GetInnermostMessage(Exception ex)
    {
        while (ex.InnerException != null)
            ex = ex.InnerException;
        return ex.Message;
    }

    private async Task NotifyKitchenAsync(OrderDto order)
    {
        try
        {
            var items = order.Items?.Select(i => new { i.Id, i.DishName, i.Quantity, i.Notes }).ToList<object>() ?? new List<object>();
            await _kitchenHub.Clients.Group("kitchen").SendAsync("NewKitchenOrder", new
            {
                orderId = order.Id,
                orderNumber = order.OrderNumber,
                items,
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo notificar a cocina para orden {OrderId}", order.Id);
        }
    }

    /// <summary>
    /// Crear nueva orden
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<OrderDto>> CreateOrder([FromBody] CreateOrderDto request)
    {
        try
        {
            var order = await _orderService.CreateOrderAsync(request);
            // No notificar a cocina al crear: la orden va al KDS solo cuando el mesero la confirme (UpdateStatus → Confirmed).
            return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Error creating order (DB)");
            var msg = GetInnermostMessage(ex);
            return BadRequest(new { error = msg });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating order");
            var msg = GetInnermostMessage(ex);
            return BadRequest(new { error = msg });
        }
    }

    /// <summary>
    /// Obtener orden por ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderDto>> GetOrder(int id)
    {
        var order = await _orderService.GetOrderByIdAsync(id);
        if (order == null)
            return NotFound(new { message = "Orden no encontrada" });

        return Ok(order);
    }

    /// <summary>
    /// Obtener todas las órdenes (admin)
    /// </summary>
    [HttpGet("all")]
    [ProducesResponseType(typeof(List<OrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OrderDto>>> GetAllOrders()
    {
        var orders = await _orderService.GetAllOrdersAsync();
        return Ok(orders);
    }

    /// <summary>
    /// Obtener órdenes activas
    /// </summary>
    [HttpGet("active")]
    [ProducesResponseType(typeof(List<OrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OrderDto>>> GetActiveOrders()
    {
        var orders = await _orderService.GetActiveOrdersAsync();
        return Ok(orders);
    }

    /// <summary>
    /// Actualizar estado de orden
    /// </summary>
    [HttpPut("{id}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusDto request)
    {
        try
        {
            var order = await _orderService.UpdateOrderStatusAsync(id, request.NewStatus);
            if (string.Equals(request.NewStatus, "Confirmed", StringComparison.OrdinalIgnoreCase))
                await NotifyKitchenAsync(order);
            return Ok(new { message = "Estado actualizado correctamente", order });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating order status");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Cocina marca "Preparando". El cliente verá Preparando solo cuando cocina y bar estén en preparando (si aplica).
    /// </summary>
    [HttpPut("{id}/kitchen-preparing")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetKitchenPreparing(int id)
    {
        try
        {
            var order = await _orderService.SetKitchenPreparingAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error kitchen preparing"); return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Cocina marca "Listo". El cliente verá Listo solo cuando cocina y bar estén listos (si aplica).
    /// </summary>
    [HttpPut("{id}/kitchen-ready")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetKitchenReady(int id)
    {
        try
        {
            var order = await _orderService.SetKitchenReadyAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error kitchen ready"); return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Bar marca "Preparando". El cliente verá Preparando solo cuando cocina y bar estén en preparando (si aplica).
    /// </summary>
    [HttpPut("{id}/bar-preparing")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetBarPreparing(int id)
    {
        try
        {
            var order = await _orderService.SetBarPreparingAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error bar preparing"); return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Bar marca "Listo". El cliente verá Listo solo cuando cocina y bar estén listos (si aplica).
    /// </summary>
    [HttpPut("{id}/bar-ready")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetBarReady(int id)
    {
        try
        {
            var order = await _orderService.SetBarReadyAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error bar ready"); return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Mesero sirvió los platos de cocina (independiente del bar)
    /// </summary>
    [HttpPut("{id}/kitchen-served")]
    public async Task<IActionResult> SetKitchenServed(int id)
    {
        try
        {
            var order = await _orderService.SetKitchenServedAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error kitchen served"); return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Mesero sirvió las bebidas del bar (independiente de la cocina)
    /// </summary>
    [HttpPut("{id}/bar-served")]
    public async Task<IActionResult> SetBarServed(int id)
    {
        try
        {
            var order = await _orderService.SetBarServedAsync(id);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { _logger.LogError(ex, "Error bar served"); return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Cliente marca que terminó de comer
    /// </summary>
    [HttpPut("{id}/customer-finished")]
    public async Task<IActionResult> MarkCustomerFinished(int id)
    {
        try
        {
            var order = await _orderService.GetOrderByIdAsync(id);
            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });

            await _orderService.MarkCustomerFinishedAsync(id);
            return Ok(new { message = "Cliente marcado como terminado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking customer finished");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Asignar mesero a orden
    /// </summary>
    [HttpPut("{id}/assign-waiter/{waiterId}")]
    public async Task<IActionResult> AssignWaiterToOrder(int id, int waiterId)
    {
        try
        {
            await _orderService.AssignWaiterAsync(id, waiterId);
            var order = await _orderService.GetOrderByIdAsync(id);
            if (order != null)
                await NotifyKitchenAsync(order);
            return Ok(new { message = "Mesero asignado exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning waiter");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Mesero abandona una mesa (desasigna la orden)
    /// </summary>
    [HttpPut("{id}/unassign-waiter")]
    public async Task<IActionResult> UnassignWaiterFromOrder(int id)
    {
        try
        {
            await _orderService.UnassignWaiterAsync(id);
            return Ok(new { message = "Mesa abandonada correctamente" });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Obtener órdenes no asignadas (para vista "Mesas General")
    /// </summary>
    [HttpGet("unassigned")]
    public async Task<IActionResult> GetUnassignedOrders()
    {
        try
        {
            var orders = await _orderService.GetUnassignedOrdersAsync();
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unassigned orders");
            return StatusCode(500, new { error = "Error al obtener órdenes" });
        }
    }

    /// <summary>
    /// Obtener órdenes por mesero (para vista "Mis Mesas")
    /// </summary>
    [HttpGet("my-orders/{waiterId}")]
    public async Task<IActionResult> GetWaiterOrders(int waiterId)
    {
        try
        {
            var orders = await _orderService.GetOrdersByWaiterAsync(waiterId);
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting waiter orders");
            return StatusCode(500, new { error = "Error al obtener órdenes" });
        }
    }

    /// <summary>
    /// Mover comensal: cambiar la orden de mesa (de una mesa a otra disponible).
    /// </summary>
    [HttpPut("{orderId}/move-to-table/{newTableId}")]
    public async Task<IActionResult> MoveOrderToTable(int orderId, int newTableId)
    {
        try
        {
            var order = await _orderService.GetOrderByIdAsync(orderId);
            if (order == null)
                return NotFound(new { error = "Orden no encontrada" });
            await _orderService.MoveOrderToTableAsync(orderId, newTableId);
            var updated = await _orderService.GetOrderByIdAsync(orderId);
            return Ok(new { message = "Orden movida a la nueva mesa", order = updated });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Orden o mesa no encontrada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving order to table");
            return StatusCode(500, new { error = "Error al mover orden" });
        }
    }
}
