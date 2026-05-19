using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SmartMenu.API.Hubs;

[Authorize]
public class OrderHub : Hub
{
    public async Task NotifyNewOrder(int orderId, int tableId)
    {
        await Clients.All.SendAsync("NewOrderCreated", new { orderId, tableId, timestamp = DateTime.UtcNow });
    }

    public async Task NotifyOrderStatusChanged(int orderId, string newStatus)
    {
        await Clients.All.SendAsync("OrderStatusChanged", new { orderId, status = newStatus, timestamp = DateTime.UtcNow });
    }

    public async Task NotifyOrderCompleted(int orderId)
    {
        await Clients.All.SendAsync("OrderCompleted", new { orderId, timestamp = DateTime.UtcNow });
    }

    public async Task JoinOrderGroup(int orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order_{orderId}");
    }

    public async Task LeaveOrderGroup(int orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order_{orderId}");
    }

    public async Task JoinWaiterGroup(int waiterId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"waiter_{waiterId}");
    }

    public async Task LeaveWaiterGroup(int waiterId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"waiter_{waiterId}");
    }

    /// <summary>
    /// El panel de admin se une a este grupo para recibir solicitudes de mesa en tiempo real.
    /// </summary>
    public async Task JoinAdminGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "admin");
    }

    public async Task LeaveAdminGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "admin");
    }
}
