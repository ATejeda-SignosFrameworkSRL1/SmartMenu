using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SmartMenu.API.Hubs;

[Authorize]
public class TableHub : Hub
{
    public async Task NotifyTableStatusChanged(int tableId, string status)
    {
        await Clients.All.SendAsync("TableStatusChanged", new
        {
            tableId,
            status,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task JoinTableGroup(int tableId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"table_{tableId}");
    }

    public async Task LeaveTableGroup(int tableId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"table_{tableId}");
    }
}
