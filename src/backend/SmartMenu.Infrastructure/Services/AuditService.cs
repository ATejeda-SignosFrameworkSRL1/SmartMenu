using System.Text.Json;
using Microsoft.Extensions.Logging;
using SmartMenu.Application.Services;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Services;

public class AuditService : IAuditService
{
    private const int MetadataMaxLength = 2048;

    private readonly ApplicationDbContext _db;
    private readonly ILogger<AuditService> _logger;

    public AuditService(ApplicationDbContext db, ILogger<AuditService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task LogAsync(
        int? userId,
        string action,
        string entityType,
        int? entityId = null,
        string? ip = null,
        string? authMethod = null,
        object? metadata = null,
        CancellationToken ct = default)
    {
        try
        {

            var normalizedUserId = userId.HasValue && userId.Value > 0 ? userId.Value : (int?)null;

            string? metaJson = null;
            if (metadata != null)
            {
                try
                {
                    metaJson = JsonSerializer.Serialize(metadata, new JsonSerializerOptions
                    {
                        WriteIndented = false,
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    });
                    if (metaJson.Length > MetadataMaxLength)
                    {
                        metaJson = metaJson.Substring(0, MetadataMaxLength - 3) + "...";
                    }
                }
                catch
                {
                    metaJson = null;
                }
            }

            _db.AuditEvents.Add(new AuditEvent
            {
                UserId = normalizedUserId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                IpAddress = ip,
                AuthMethod = authMethod ?? (normalizedUserId.HasValue ? "password" : "anonymous"),
                Metadata = metaJson,
                OccurredAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {

            _logger.LogWarning(ex,
                "AuditService: failed to write AuditEvent for User={UserId} Action={Action}",
                userId, action);
        }
    }
}
