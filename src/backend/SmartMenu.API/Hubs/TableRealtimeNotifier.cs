using Microsoft.AspNetCore.SignalR;
using SmartMenu.Application.Services;

namespace SmartMenu.API.Hubs;

public class TableRealtimeNotifier : ITableRealtimeNotifier
{
    private readonly IHubContext<TableHub> _hub;

    public TableRealtimeNotifier(IHubContext<TableHub> hub) => _hub = hub;

    public Task TableStatusChangedAsync(int tableId, string status) =>
        _hub.Clients.All.SendAsync("TableStatusChanged", new { tableId, status, timestamp = DateTime.UtcNow });

    public Task TableWaiterChangedAsync(int tableId, string? waiterInitials, string? waiterName) =>
        _hub.Clients.All.SendAsync("TableWaiterChanged", new { tableId, waiter = waiterInitials, waiterName, timestamp = DateTime.UtcNow });

    public Task FloorPlanVisibilityChangedAsync(bool hostEnabled, bool waiterEnabled) =>
        _hub.Clients.All.SendAsync("FloorPlanVisibilityChanged", new { hostEnabled, waiterEnabled, timestamp = DateTime.UtcNow });
}
