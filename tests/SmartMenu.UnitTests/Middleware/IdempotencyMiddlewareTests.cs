using System.Text;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using SmartMenu.API.Middleware;

namespace SmartMenu.UnitTests.Middleware;

/// <summary>
/// S1.D2 — IdempotencyMiddleware: replay defense en POST /api/order y /api/payment.
/// Verifica ShouldApply (path + method), header gate, cache hit/miss, body-hash bucket.
/// </summary>
public class IdempotencyMiddlewareTests
{
    private static IMemoryCache NewCache() => new MemoryCache(new MemoryCacheOptions());

    private static DefaultHttpContext NewCtx(string method, string path, string? idempKey = null, string body = "")
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = method;
        ctx.Request.Path = path;
        if (!string.IsNullOrEmpty(idempKey))
            ctx.Request.Headers["Idempotency-Key"] = idempKey;
        if (!string.IsNullOrEmpty(body))
        {
            var bytes = Encoding.UTF8.GetBytes(body);
            ctx.Request.Body = new MemoryStream(bytes);
            ctx.Request.ContentLength = bytes.Length;
        }
        ctx.Response.Body = new MemoryStream();
        return ctx;
    }

    private static IdempotencyMiddleware Build(RequestDelegate next, IMemoryCache cache) =>
        new(next, cache, NullLogger<IdempotencyMiddleware>.Instance);

    [Theory]
    [InlineData("GET",  "/api/order")]
    [InlineData("DELETE", "/api/order")]
    [InlineData("POST", "/api/menu")]    // ruta no idempotente-aware
    [InlineData("POST", "/api/dish")]
    public async Task ShouldApply_false_bypasses_middleware(string method, string path)
    {
        var ctx = NewCtx(method, path, idempKey: "fixed-key");
        var calls = 0;
        RequestDelegate next = _ => { calls++; return Task.CompletedTask; };
        var mw = Build(next, NewCache());

        await mw.Invoke(ctx);

        calls.Should().Be(1); // delegate ejecutado normal
        ctx.Response.Headers.Should().NotContainKey("X-Idempotency-Replay");
    }

    [Fact]
    public async Task POST_order_without_IdempotencyKey_passes_through()
    {
        var ctx = NewCtx("POST", "/api/order");
        var calls = 0;
        RequestDelegate next = _ => { calls++; return Task.CompletedTask; };
        var mw = Build(next, NewCache());

        await mw.Invoke(ctx);

        calls.Should().Be(1);
        ctx.Response.Headers.Should().NotContainKey("X-Idempotency-Replay");
    }

    [Fact]
    public async Task POST_payment_with_IdempotencyKey_caches_2xx_response()
    {
        var cache = NewCache();
        var ctx = NewCtx("POST", "/api/payment/collect", idempKey: "abc-123", body: """{"orderId":1}""");
        var calls = 0;
        RequestDelegate next = async c =>
        {
            calls++;
            c.Response.StatusCode = 200;
            c.Response.ContentType = "application/json";
            await c.Response.WriteAsync("{\"ok\":true}");
        };
        var mw = Build(next, cache);

        await mw.Invoke(ctx);

        calls.Should().Be(1);
        ctx.Response.StatusCode.Should().Be(200);

        // Segundo request idéntico → replay desde cache, delegate NO se llama.
        var ctx2 = NewCtx("POST", "/api/payment/collect", idempKey: "abc-123", body: """{"orderId":1}""");
        await mw.Invoke(ctx2);

        calls.Should().Be(1); // sigue siendo 1
        ctx2.Response.Headers["X-Idempotency-Replay"].ToString().Should().Be("true");
        ctx2.Response.Body.Position = 0;
        var replayBody = await new StreamReader(ctx2.Response.Body).ReadToEndAsync();
        replayBody.Should().Contain("\"ok\":true");
    }

    [Fact]
    public async Task NonSuccess_response_is_not_cached()
    {
        var cache = NewCache();
        var ctx = NewCtx("POST", "/api/order", idempKey: "key-fail", body: "{}");
        var calls = 0;
        RequestDelegate next = c =>
        {
            calls++;
            c.Response.StatusCode = 400; // bad request, no se cachea
            return Task.CompletedTask;
        };
        var mw = Build(next, cache);

        await mw.Invoke(ctx);
        var ctx2 = NewCtx("POST", "/api/order", idempKey: "key-fail", body: "{}");
        await mw.Invoke(ctx2);

        calls.Should().Be(2); // delegate corrió 2 veces (no se cacheó el 4xx)
        ctx2.Response.Headers.Should().NotContainKey("X-Idempotency-Replay");
    }

    [Fact]
    public async Task Different_body_with_same_key_is_treated_as_different_request()
    {
        // Defensivo: si el body cambia con la misma key, no se devuelve el cache anterior.
        var cache = NewCache();
        var calls = 0;
        RequestDelegate next = async c =>
        {
            calls++;
            c.Response.StatusCode = 200;
            c.Response.ContentType = "application/json";
            await c.Response.WriteAsync("{}");
        };
        var mw = Build(next, cache);

        await mw.Invoke(NewCtx("POST", "/api/order", idempKey: "k", body: """{"a":1}"""));
        await mw.Invoke(NewCtx("POST", "/api/order", idempKey: "k", body: """{"a":2}"""));

        calls.Should().Be(2); // distinto body-hash → ambos ejecutaron
    }
}
