using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using SmartMenu.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, services, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "SmartMenu.API")
    .Enrich.WithProperty("Environment", ctx.HostingEnvironment.EnvironmentName)
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File(
        path: Path.Combine("logs", "smartmenu-.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"));

var devCertPath = Path.Combine(Directory.GetCurrentDirectory(), "dev-cert.pfx");
var devCertPassword = builder.Configuration["DevCert:Password"] ?? "SmartMenuDev";
var inContainer = string.Equals(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"), "true", StringComparison.OrdinalIgnoreCase);
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 20_971_520;

    if (inContainer) return;

    serverOptions.ListenAnyIP(5041);
    serverOptions.ListenAnyIP(5042, listenOptions =>
    {
        if (File.Exists(devCertPath))
            listenOptions.UseHttps(devCertPath, devCertPassword);
        else
            listenOptions.UseHttps();
    });
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 20_971_520;
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<SmartMenu.API.Data.AuditInterceptor>();

builder.Services.AddDbContext<SmartMenu.Infrastructure.Data.AuditDbContext>(options =>
{
    var auditConn = builder.Configuration.GetConnectionString("AuditConnection")
        ?? builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlServer(auditConn, b => b.MigrationsAssembly("SmartMenu.Infrastructure").MigrationsHistoryTable("__AuditMigrationsHistory"));
});

builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        b => b.MigrationsAssembly("SmartMenu.Infrastructure"));
    options.AddInterceptors(sp.GetRequiredService<SmartMenu.API.Data.AuditInterceptor>());

});

var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["Secret"];

if (string.IsNullOrWhiteSpace(secretKey) || secretKey.StartsWith("your-super-secret"))
{
    throw new InvalidOperationException(
        "JWT secret is missing or is the default placeholder. Set JwtSettings:Secret via environment variable, user-secrets, or appsettings.Development.json.");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey ?? throw new ArgumentNullException("JWT Secret")))
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{

    options.AddFixedWindowLimiter("rnc", o =>
    {
        o.PermitLimit = 10;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueLimit = 0;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    options.AddFixedWindowLimiter("invoices", o =>
    {
        o.PermitLimit = 6;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueLimit = 0;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 600,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        policy.WithOrigins(origins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });

    options.AddPolicy("AllowAllInDev", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddScoped(typeof(SmartMenu.Application.Repositories.IRepository<>), typeof(SmartMenu.Infrastructure.Repositories.Repository<>));
builder.Services.AddScoped<SmartMenu.Application.Repositories.IUserRepository, SmartMenu.Infrastructure.Repositories.UserRepository>();
builder.Services.AddScoped<SmartMenu.Application.Repositories.IOrderRepository, SmartMenu.Infrastructure.Repositories.OrderRepository>();

builder.Services.Configure<SmartMenu.Application.Settings.BillingSettings>(
    builder.Configuration.GetSection(SmartMenu.Application.Settings.BillingSettings.SectionName));
builder.Services.Configure<SmartMenu.Application.Settings.ReservationSettings>(
    builder.Configuration.GetSection(SmartMenu.Application.Settings.ReservationSettings.SectionName));

builder.Services.AddScoped<SmartMenu.Application.Services.IAuthService, SmartMenu.Infrastructure.Services.AuthService>();

builder.Services.AddScoped<SmartMenu.Application.Services.IAuditService, SmartMenu.Infrastructure.Services.AuditService>();
builder.Services.AddSingleton<SmartMenu.Application.Services.ITableRealtimeNotifier, SmartMenu.API.Hubs.TableRealtimeNotifier>();

builder.Services.AddScoped<SmartMenu.Application.Services.ITableStatusBroadcaster, SmartMenu.Infrastructure.Services.TableStatusBroadcaster>();
builder.Services.AddScoped<SmartMenu.Application.Services.IOrderService, SmartMenu.Infrastructure.Services.OrderService>();
builder.Services.AddScoped<SmartMenu.Application.Services.IInvoiceService, SmartMenu.Infrastructure.Services.InvoiceService>();

builder.Services.AddScoped<SmartMenu.Application.Services.INotificationService, SmartMenu.Infrastructure.Services.LoggingNotificationService>();
builder.Services.AddScoped<SmartMenu.Application.Services.IDepositService, SmartMenu.Infrastructure.Services.NoopDepositService>();
builder.Services.AddScoped<SmartMenu.Application.Services.IReservationAvailabilityService, SmartMenu.Infrastructure.Services.ReservationAvailabilityService>();
builder.Services.AddScoped<SmartMenu.Application.Services.IReservationService, SmartMenu.Infrastructure.Services.ReservationService>();

builder.Services.AddHostedService<SmartMenu.API.BackgroundServices.ReservationLifecycleService>();

builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>(
        name: "database",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "ready", "db" });

builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r
        .AddService(serviceName: "SmartMenu.API", serviceVersion: "1.0.0")
        .AddAttributes(new[] { new KeyValuePair<string, object>("environment", builder.Environment.EnvironmentName) }))
    .WithTracing(t =>
    {
        t.AddAspNetCoreInstrumentation(o =>
        {

            o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health")
                           && !ctx.Request.Path.StartsWithSegments("/metrics");
        })
         .AddHttpClientInstrumentation()
         .AddSource("Microsoft.EntityFrameworkCore");
        if (builder.Environment.IsDevelopment())
            t.AddConsoleExporter();
    })
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddPrometheusExporter());

builder.Services.AddSignalR();

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never;

        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SmartMenu API",
        Version = "v1",
        Description = "API para el sistema SmartMenu - Menú digital para restaurantes",
        Contact = new OpenApiContact
        {
            Name = "SmartMenu Team",
            Email = "support@smartmenu.com.do"
        }
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header usando el esquema Bearer. Ejemplo: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
    opts.GetLevel = (httpCtx, _, _) =>
    {
        var p = httpCtx.Request.Path;
        if (p.StartsWithSegments("/hubs") || p.StartsWithSegments("/metrics") || p.StartsWithSegments("/health"))
            return Serilog.Events.LogEventLevel.Verbose;
        return Serilog.Events.LogEventLevel.Information;
    };
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "SmartMenu API v1");
        c.RoutePrefix = string.Empty;
    });
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

var wwwRoot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwRoot))
    Directory.CreateDirectory(wwwRoot);
app.UseStaticFiles();

app.UseCors(app.Environment.IsDevelopment() ? "AllowAllInDev" : "AllowAll");

app.UseMiddleware<SmartMenu.API.Middleware.ExceptionHandlingMiddleware>();

app.UseMiddleware<SmartMenu.API.Middleware.IdempotencyMiddleware>();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHub<SmartMenu.API.Hubs.OrderHub>("/hubs/orders");
app.MapHub<SmartMenu.API.Hubs.KitchenHub>("/hubs/kitchen");
app.MapHub<SmartMenu.API.Hubs.TableHub>("/hubs/tables");
app.MapHub<SmartMenu.API.Hubs.ReservationHub>("/hubs/reservations");

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = WriteHealthJson
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = c => c.Tags.Contains("ready"),
    ResponseWriter = WriteHealthJson
});

app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    timestamp = DateTime.UtcNow,
    version = "1.0.0",
    environment = app.Environment.EnvironmentName
}));

app.MapPrometheusScrapingEndpoint();

static Task WriteHealthJson(HttpContext ctx, HealthReport report)
{
    ctx.Response.ContentType = "application/json; charset=utf-8";
    var payload = new
    {
        status = report.Status.ToString(),
        totalDurationMs = report.TotalDuration.TotalMilliseconds,
        entries = report.Entries.ToDictionary(
            e => e.Key,
            e => new
            {
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                durationMs = e.Value.Duration.TotalMilliseconds,
                error = e.Value.Exception?.Message
            })
    };
    return ctx.Response.WriteAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    }));
}

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    await context.Database.MigrateAsync();

    var auditContext = scope.ServiceProvider.GetRequiredService<SmartMenu.Infrastructure.Data.AuditDbContext>();
    await auditContext.Database.MigrateAsync();

    await SmartMenu.Infrastructure.Data.DbInitializer.SeedAsync(context);

    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureExtraWaiterAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureCashierAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureDishTagsSeedAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureBartenderRoleAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureDeliveryUserAsync(context);

    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureDefaultServicePeriodsAsync(context);

}

app.Run();

public partial class Program { }
