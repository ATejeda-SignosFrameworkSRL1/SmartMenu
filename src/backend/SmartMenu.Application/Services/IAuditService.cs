namespace SmartMenu.Application.Services;

public interface IAuditService
{

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
