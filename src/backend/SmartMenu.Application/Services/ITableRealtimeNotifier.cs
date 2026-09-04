namespace SmartMenu.Application.Services;

public interface ITableRealtimeNotifier
{

    Task TableStatusChangedAsync(int tableId, string status);

    Task TableWaiterChangedAsync(int tableId, string? waiterInitials, string? waiterName);

    Task FloorPlanVisibilityChangedAsync(bool hostEnabled, bool waiterEnabled);
}
