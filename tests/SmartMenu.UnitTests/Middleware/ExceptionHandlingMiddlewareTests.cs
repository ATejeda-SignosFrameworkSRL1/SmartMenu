using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SmartMenu.API.Middleware;
using SmartMenu.Application.Exceptions;

namespace SmartMenu.UnitTests.Middleware;

/// <summary>
/// S1.D2 — ExceptionHandlingMiddleware: mapeo de excepciones de dominio a códigos HTTP.
/// Cada branch de <c>Map()</c> verificado vía DefaultHttpContext + delegate que lanza.
/// </summary>
public class ExceptionHandlingMiddlewareTests
{
    private static async Task<(int Status, string Body, string? ContentType)> RunMiddleware(
        Exception toThrow,
        bool isDevelopment = false)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        ctx.Request.Method = "GET";
        ctx.Request.Path = "/test";

        var env = new Mock<IHostEnvironment>();
        env.SetupGet(e => e.EnvironmentName).Returns(isDevelopment ? "Development" : "Production");

        RequestDelegate next = _ => throw toThrow;
        var mw = new ExceptionHandlingMiddleware(next, NullLogger<ExceptionHandlingMiddleware>.Instance, env.Object);
        await mw.Invoke(ctx);

        ctx.Response.Body.Position = 0;
        var body = await new StreamReader(ctx.Response.Body).ReadToEndAsync();
        return (ctx.Response.StatusCode, body, ctx.Response.ContentType);
    }

    [Fact]
    public async Task NotFoundException_maps_to_404()
    {
        var (status, body, _) = await RunMiddleware(new NotFoundException("Dish 42 no encontrado."));
        status.Should().Be(404);
        body.Should().Contain("Dish 42 no encontrado.");
    }

    [Fact]
    public async Task NotFoundException_For_T_id_helper_produces_typed_message()
    {
        var ex = NotFoundException.For<DateTime>(7);
        ex.Message.Should().Be("DateTime 7 no encontrado.");
    }

    [Fact]
    public async Task ValidationException_without_errors_maps_to_400_with_error_only()
    {
        var (status, body, _) = await RunMiddleware(new ValidationException("Input invalid"));
        status.Should().Be(400);
        body.Should().Contain("Input invalid");
        body.Should().NotContain("\"errors\""); // sin diccionario
    }

    [Fact]
    public async Task ValidationException_with_errors_maps_to_400_with_errors_dict()
    {
        var errors = new Dictionary<string, string[]> { ["Email"] = new[] { "Required" } };
        var (status, body, _) = await RunMiddleware(new ValidationException("Invalid", errors));
        status.Should().Be(400);
        body.Should().Contain("\"errors\"");
        body.Should().Contain("Email");
        body.Should().Contain("Required");
    }

    [Fact]
    public async Task ConflictException_maps_to_409()
    {
        var (status, _, _) = await RunMiddleware(new ConflictException("Estado inválido."));
        status.Should().Be(409);
    }

    [Fact]
    public async Task ForbiddenException_maps_to_403()
    {
        var (status, _, _) = await RunMiddleware(new ForbiddenException());
        status.Should().Be(403);
    }

    [Fact]
    public async Task KeyNotFoundException_maps_to_404()
    {
        var (status, _, _) = await RunMiddleware(new KeyNotFoundException("Order 1 not found"));
        status.Should().Be(404);
    }

    [Fact]
    public async Task ArgumentException_maps_to_400()
    {
        var (status, _, _) = await RunMiddleware(new ArgumentException("Cantidad inválida"));
        status.Should().Be(400);
    }

    [Fact]
    public async Task UnauthorizedAccessException_maps_to_401()
    {
        var (status, _, _) = await RunMiddleware(new UnauthorizedAccessException("Invalid credentials"));
        status.Should().Be(401);
    }

    [Fact]
    public async Task InvalidOperationException_maps_to_400()
    {
        var (status, _, _) = await RunMiddleware(new InvalidOperationException("Transición inválida"));
        status.Should().Be(400);
    }

    [Fact]
    public async Task DbUpdateConcurrencyException_maps_to_409()
    {
        var (status, body, _) = await RunMiddleware(new DbUpdateConcurrencyException("conflict"));
        status.Should().Be(409);
        // El acento de "modificó" se serializa como ó en JSON ASCII-safe — verificar ASCII parts.
        body.Should().Contain("Otro usuario");
        body.Should().Contain("Recarga");
    }

    [Fact]
    public async Task TaskCanceledException_maps_to_499()
    {
        var (status, _, _) = await RunMiddleware(new TaskCanceledException("cancelled"));
        status.Should().Be(499);
    }

    [Fact]
    public async Task OperationCanceledException_maps_to_499()
    {
        var (status, _, _) = await RunMiddleware(new OperationCanceledException("cancelled"));
        status.Should().Be(499);
    }

    [Fact]
    public async Task Generic_Exception_in_production_hides_internal_details()
    {
        var (status, body, _) = await RunMiddleware(new Exception("secret stack trace info"), isDevelopment: false);
        status.Should().Be(500);
        body.Should().Contain("Error interno del servidor.");
        body.Should().NotContain("secret stack trace info"); // no filtrar internals
    }

    [Fact]
    public async Task Generic_Exception_in_development_shows_stack_for_debugging()
    {
        var (status, body, _) = await RunMiddleware(new Exception("dev-only-detail"), isDevelopment: true);
        status.Should().Be(500);
        body.Should().Contain("dev-only-detail");
    }

    [Fact]
    public async Task Response_uses_camelCase_json_and_utf8_content_type()
    {
        var (_, body, ct) = await RunMiddleware(new NotFoundException("not found"));
        ct.Should().Contain("application/json");
        ct.Should().Contain("utf-8");
        // El payload usa CamelCase: { "error": "..." } no { "Error": "..." }
        body.Should().Contain("\"error\"");
        body.Should().NotContain("\"Error\":"); // PascalCase no aparece
    }

    [Fact]
    public async Task Pipeline_passes_through_when_no_exception_thrown()
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        var env = new Mock<IHostEnvironment>();
        env.SetupGet(e => e.EnvironmentName).Returns("Production");
        var called = false;
        RequestDelegate next = _ => { called = true; return Task.CompletedTask; };
        var mw = new ExceptionHandlingMiddleware(next, NullLogger<ExceptionHandlingMiddleware>.Instance, env.Object);
        await mw.Invoke(ctx);
        called.Should().BeTrue();
        // Sin excepción: status no se toca (queda en default 200).
        ctx.Response.StatusCode.Should().Be(200);
    }
}
