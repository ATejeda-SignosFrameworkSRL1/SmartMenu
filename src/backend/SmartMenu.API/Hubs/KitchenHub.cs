using Microsoft.AspNetCore.SignalR;

namespace SmartMenu.API.Hubs;

public class KitchenHub : Hub
{
    public async Task NotifyNewOrderForKitchen(int orderId, string orderNumber, List<object> items)
    {
        await Clients.Group("kitchen").SendAsync("NewKitchenOrder", new
        {
            orderId,
            orderNumber,
            items,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task NotifyItemReady(int orderId, int itemId)
    {
        await Clients.All.SendAsync("KitchenItemReady", new
        {
            orderId,
            itemId,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task JoinKitchenGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "kitchen");
    }

    public async Task LeaveKitchenGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "kitchen");
    }

    public override async Task OnConnectedAsync()
    {
        // Auto-join kitchen group para KDS
        await Groups.AddToGroupAsync(Context.ConnectionId, "kitchen");
        await base.OnConnectedAsync();
    }
}
