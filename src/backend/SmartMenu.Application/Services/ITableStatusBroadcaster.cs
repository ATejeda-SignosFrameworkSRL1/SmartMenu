namespace SmartMenu.Application.Services;

public interface ITableStatusBroadcaster
{
    Task BroadcastAsync(int tableId, CancellationToken ct = default);
    Task BroadcastAsync(IEnumerable<int> tableIds, CancellationToken ct = default);
}
