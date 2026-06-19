using System.Text.Json;
using Microsoft.Extensions.Logging;
using SmartMenu.Application.Services;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Services;

/// <summary>
/// Sprint 4.2 — Implementación del audit log.
///
/// Diseñado fail-safe: si el INSERT falla, log warning pero NO propagar excepción.
/// La acción principal del usuario nunca debe fallar por un audit-write fallido.
///
/// Metadata se serializa a JSON con max 2048 chars — si excede se trunca.
/// </summary>
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

    // AUDIT-FIX.1: userId nullable. Antes int → si llegaba 0 (cliente anónimo)
    // y AuditEvents.UserId tenía FK a Users, el INSERT lanzaba FK violation y el
    // fail-safe lo silenciaba; resultado: Order.Created del cliente final NUNCA
    // se persistía. Ahora aceptamos null para esos casos.
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
            // Normalizar: userId=0 (default int de TryParse fallido) → null.
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
                    metaJson = null;  // si la serialización falla, no incluimos metadata
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
            // Fail-safe: NO propagar. Logear como warning para alertas posteriores.
            _logger.LogWarning(ex,
                "AuditService: failed to write AuditEvent for User={UserId} Action={Action}",
                userId, action);
        }
    }
}
