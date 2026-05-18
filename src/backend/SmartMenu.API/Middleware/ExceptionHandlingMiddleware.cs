using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Application.Exceptions;

namespace SmartMenu.API.Middleware;

/// <summary>
/// Atrapa toda excepción no manejada en el pipeline y la convierte a un response
/// JSON consistente: <c>{ error: string, errors?: { field: string[] } }</c>.
/// Mapea tipos de dominio a códigos HTTP. Loguea el stack completo internamente y
/// solo expone detalles si el ambiente es Development.
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (Exception ex)
        {
            await WriteAsync(ctx, ex);
        }
    }

    private async Task WriteAsync(HttpContext ctx, Exception ex)
    {
        var (status, payload) = Map(ex);

        if (status >= 500)
            _logger.LogError(ex, "Unhandled exception {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
        else
            _logger.LogWarning(ex, "Domain exception {Type} {Method} {Path}", ex.GetType().Name, ctx.Request.Method, ctx.Request.Path);

        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
    }

    private (int Status, object Payload) Map(Exception ex)
    {
        switch (ex)
        {
            case NotFoundException nf:
                return (StatusCodes.Status404NotFound, new { error = nf.Message });

            case ValidationException val:
                return val.Errors is { Count: > 0 }
                    ? (StatusCodes.Status400BadRequest, new { error = val.Message, errors = val.Errors })
                    : (StatusCodes.Status400BadRequest, new { error = val.Message });

            case ConflictException con:
                return (StatusCodes.Status409Conflict, new { error = con.Message });

            case ForbiddenException fb:
                return (StatusCodes.Status403Forbidden, new { error = fb.Message });

            case KeyNotFoundException knf:
                return (StatusCodes.Status404NotFound, new { error = knf.Message });

            case ArgumentException arg:
                return (StatusCodes.Status400BadRequest, new { error = arg.Message });

            case UnauthorizedAccessException ua:
                return (StatusCodes.Status401Unauthorized, new { error = ua.Message });

            case InvalidOperationException io:
                return (StatusCodes.Status400BadRequest, new { error = io.Message });

            case DbUpdateConcurrencyException:
                return (StatusCodes.Status409Conflict, new { error = "Otro usuario modificó este registro. Recarga e intenta de nuevo." });

            case TaskCanceledException or OperationCanceledException:
                return (499, new { error = "Petición cancelada." }); // 499 Client Closed Request (nginx convention)

            default:
                // No filtrar detalles internos en respuesta — el logger ya tiene el stack.
                var safeMessage = _env.IsDevelopment() ? ex.ToString() : "Error interno del servidor.";
                return (StatusCodes.Status500InternalServerError, new { error = safeMessage });
        }
    }
}
