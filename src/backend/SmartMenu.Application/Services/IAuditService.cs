namespace SmartMenu.Application.Services;

/// <summary>
/// Sprint 4.2 — Servicio para registrar acciones sensibles en AuditEvents.
///
/// Uso típico desde un controller:
/// <code>
///   await _audit.LogAsync(
///       userId: GetCurrentUserId(),
///       action: "Order.Created",
///       entityType: "Order",
///       entityId: order.Id,
///       ip: HttpContext.Connection.RemoteIpAddress?.ToString(),
///       authMethod: GetAuthMethodFromJwt(),
///       metadata: new { total = order.Total, items = order.Items.Count }
///   );
/// </code>
/// Fail-safe: si el insert falla, NO debe abortar la acción principal.
/// </summary>
public interface IAuditService
{
    // AUDIT-FIX.1: userId nullable para soportar clientes finales anónimos (sin JWT).
    Task LogAsync(
        int? userId,
        string action,
        string entityType,
        int? entityId = null,
        string? ip = null,
        string? authMethod = null,
        object? metadata = null,
        CancellationToken ct = default
    );
}
