namespace SmartMenu.Application.Services;

/// <summary>
/// Difunde cambios de estado de mesa en tiempo real. La implementación vive en la
/// capa API (sobre SignalR /hubs/tables), pero la abstracción está en Application
/// para que servicios de Infrastructure (ej. OrderService) puedan disparar el evento
/// sin depender de la API (Clean Architecture).
/// </summary>
public interface ITableRealtimeNotifier
{
    /// <summary>Notifica que una mesa cambió de estado. `status` = nombre del enum (ej. "Occupied").</summary>
    Task TableStatusChangedAsync(int tableId, string status);

    /// <summary>
    /// Notifica que cambió el mesero a cargo de una mesa. `waiterInitials`/`waiterName` = null
    /// cuando ya no hay mesero (mesa liberada o sin asignar) → el badge del plano se limpia.
    /// </summary>
    Task TableWaiterChangedAsync(int tableId, string? waiterInitials, string? waiterName);
}
