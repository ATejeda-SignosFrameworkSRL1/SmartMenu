using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace SmartMenu.API.Middleware;

/// <summary>
/// S4.4 — Idempotency middleware. Si el cliente envía Idempotency-Key (UUID) en un POST
/// que ya se procesó en las últimas 24h, devuelve la respuesta cacheada en lugar de
/// re-ejecutar. Evita doble-click / retry de red duplicando órdenes o pagos.
///
/// Solo se aplica a métodos POST/PUT/PATCH en rutas /api/order y /api/payment.
/// Para otras rutas, pasa sin tocar (rendimiento).
/// </summary>
public class IdempotencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMemoryCache _cache;
    private readonly ILogger<IdempotencyMiddleware> _logger;
    private static readonly TimeSpan TTL = TimeSpan.FromHours(24);

    public IdempotencyMiddleware(RequestDelegate next, IMemoryCache cache, ILogger<IdempotencyMiddleware> logger)
    {
        _next = next;
        _cache = cache;
        _logger = logger;
    }

    public async Task Invoke(HttpContext ctx)
    {
        if (!ShouldApply(ctx))
        {
            await _next(ctx);
            return;
        }

        var idempotencyKey = ctx.Request.Headers["Idempotency-Key"].ToString();
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            // Sin header: pasar (compat con clientes que aún no lo envían).
            await _next(ctx);
            return;
        }

        // Cache key = userId + idempotencyKey + path + body hash (defensivo: si cambia el body con la misma key,
        // se considera otro request y se procesa de nuevo — evita confusiones del cliente).
        var userId = ctx.User?.FindFirst("sub")?.Value ?? "anon";
        var bodyHash = await ComputeBodyHashAsync(ctx);
        var cacheKey = $"idemp:{userId}:{ctx.Request.Path}:{idempotencyKey}:{bodyHash}";

        if (_cache.TryGetValue<CachedResponse>(cacheKey, out var cached) && cached is not null)
        {
            ctx.Response.StatusCode = cached.StatusCode;
            ctx.Response.ContentType = cached.ContentType ?? "application/json";
            ctx.Response.Headers["X-Idempotency-Replay"] = "true";
            if (cached.Body is not null)
                await ctx.Response.Body.WriteAsync(cached.Body, 0, cached.Body.Length);
            _logger.LogInformation("Idempotent replay for key {Key} on {Path}", idempotencyKey, ctx.Request.Path);
            return;
        }

        // Capturar la respuesta y guardarla en cache.
        var originalBody = ctx.Response.Body;
        using var ms = new MemoryStream();
        ctx.Response.Body = ms;
        try
        {
            await _next(ctx);
        }
        finally
        {
            ctx.Response.Body = originalBody;
        }

        ms.Position = 0;
        var responseBytes = ms.ToArray();
        // Solo cachear 2xx para no replicar errores transitorios.
        if (ctx.Response.StatusCode >= 200 && ctx.Response.StatusCode < 300)
        {
            _cache.Set(cacheKey, new CachedResponse(
                StatusCode: ctx.Response.StatusCode,
                ContentType: ctx.Response.ContentType,
                Body: responseBytes), TTL);
        }
        await originalBody.WriteAsync(responseBytes, 0, responseBytes.Length);
    }

    private static bool ShouldApply(HttpContext ctx)
    {
        var method = ctx.Request.Method;
        if (method != "POST" && method != "PUT" && method != "PATCH") return false;
        var path = ctx.Request.Path.Value ?? "";
        return path.StartsWith("/api/order", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/payment", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<string> ComputeBodyHashAsync(HttpContext ctx)
    {
        ctx.Request.EnableBuffering();
        ctx.Request.Body.Position = 0;
        using var sha = SHA256.Create();
        using var ms = new MemoryStream();
        await ctx.Request.Body.CopyToAsync(ms);
        ctx.Request.Body.Position = 0;
        return Convert.ToHexString(sha.ComputeHash(ms.ToArray()));
    }

    private record CachedResponse(int StatusCode, string? ContentType, byte[]? Body);
}
