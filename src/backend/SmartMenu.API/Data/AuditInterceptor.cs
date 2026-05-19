using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Data;

/// <summary>
/// S4.1 — SaveChangesInterceptor: detecta cambios a entidades sensibles
/// (Dish, User, Payment, Order, Restaurant) en ApplicationDbContext y los
/// registra como AuditLog rows en AuditDbContext (DB separada).
///
/// Diseño defensivo: si la escritura a Audit DB falla, NO propaga la excepción
/// al SaveChanges principal — solo loguea. La auditoría no debe bloquear
/// operación legítima si el audit DB está caído.
/// </summary>
public class AuditInterceptor : SaveChangesInterceptor
{
    private static readonly HashSet<string> AuditedTypes = new()
    {
        nameof(Dish), nameof(User), nameof(Payment), nameof(Order),
        nameof(Restaurant), nameof(Table), nameof(WaiterShift)
    };

    private readonly IServiceProvider _provider;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<AuditInterceptor> _logger;

    public AuditInterceptor(IServiceProvider provider, IHttpContextAccessor http, ILogger<AuditInterceptor> logger)
    {
        _provider = provider;
        _http = http;
        _logger = logger;
    }

    // AsyncLocal: capturamos los cambios en SavingChangesAsync (antes del save, mientras
    // el ChangeTracker aún tiene los EntityState reales) y los escribimos en SavedChangesAsync
    // (después del éxito) para no bloquear ni perder integridad si el save principal falla.
    private static readonly AsyncLocal<List<AuditLog>?> _pending = new();

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        try
        {
            var ctx = eventData.Context;
            if (ctx != null)
            {
                var logs = ctx.ChangeTracker.Entries()
                    .Where(e => AuditedTypes.Contains(e.Entity.GetType().Name)
                                && e.State != EntityState.Unchanged
                                && e.State != EntityState.Detached)
                    .Select(BuildLog)
                    .Where(log => log != null)
                    .Cast<AuditLog>()
                    .ToList();
                _pending.Value = logs.Count > 0 ? logs : null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Audit capture failed in SavingChangesAsync");
        }
        return ValueTask.FromResult(result);
    }

    public override async ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        var pending = _pending.Value;
        _pending.Value = null;
        if (pending == null || pending.Count == 0) return result;

        try
        {
            using var scope = _provider.CreateScope();
            var audit = scope.ServiceProvider.GetRequiredService<AuditDbContext>();
            audit.AuditLogs.AddRange(pending);
            await audit.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Nunca bloquear el SaveChanges principal por fallo de audit.
            _logger.LogError(ex, "Audit log write failed");
        }
        return result;
    }

    private AuditLog? BuildLog(EntityEntry entry)
    {
        var entityName = entry.Entity.GetType().Name;
        var idProp = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
        var entityId = idProp?.CurrentValue?.ToString() ?? "";

        string? changesJson = null;
        try
        {
            if (entry.State == EntityState.Modified)
            {
                var changes = entry.Properties
                    .Where(p => p.IsModified && !p.Metadata.IsPrimaryKey())
                    .ToDictionary(
                        p => p.Metadata.Name,
                        p => new { old = p.OriginalValue?.ToString(), @new = p.CurrentValue?.ToString() });
                changesJson = JsonSerializer.Serialize(changes);
            }
            else
            {
                var snapshot = entry.Properties
                    .Where(p => !p.Metadata.IsPrimaryKey())
                    .ToDictionary(p => p.Metadata.Name, p => p.CurrentValue?.ToString());
                changesJson = JsonSerializer.Serialize(snapshot);
            }
        }
        catch { /* serialización defensiva */ }

        var http = _http.HttpContext;
        var userId = int.TryParse(http?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                              ?? http?.User?.FindFirst("sub")?.Value, out var uid) ? uid : (int?)null;
        var userEmail = http?.User?.FindFirst(ClaimTypes.Email)?.Value;

        return new AuditLog
        {
            EntityName = entityName,
            EntityId = entityId,
            Action = entry.State.ToString(),
            ChangesJson = changesJson,
            UserId = userId,
            UserEmail = userEmail,
            Endpoint = http?.Request?.Path.Value,
            IpAddress = http?.Connection?.RemoteIpAddress?.ToString(),
            Timestamp = DateTime.UtcNow
        };
    }
}
