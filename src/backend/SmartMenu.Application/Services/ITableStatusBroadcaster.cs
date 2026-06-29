namespace SmartMenu.Application.Services;

/// <summary>
/// Punto ÚNICO de difusión del estado de mesa por SignalR. Dado un tableId, calcula el estado
/// EFECTIVO actual (Table.Status + reserva dinámica, vía TableStatusEvaluator) y emite
/// TableStatusChanged a través de ITableRealtimeNotifier.
///
/// Regla del proyecto: TODA operación que cambie el estado de una mesa debe llamar a este
/// broadcaster DESPUÉS de persistir, sin importar el origen (orden, pago, sesión, reserva,
/// mesa virtual, cambio manual…). Es aditivo y a prueba de fallos: nunca debe romper la
/// operación de negocio.
/// </summary>
public interface ITableStatusBroadcaster
{
    Task BroadcastAsync(int tableId, CancellationToken ct = default);
    Task BroadcastAsync(IEnumerable<int> tableIds, CancellationToken ct = default);
}
