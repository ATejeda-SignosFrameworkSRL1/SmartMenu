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

// ===== SERILOG =====
// Reemplaza el logger default por Serilog: console estructurado + file rolling diario.
// La config viene de appsettings.json sección "Serilog" si existe; los enrichers/sinks
// por defecto se aplican como fallback.
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

// HTTP 5041 + HTTPS 5042 (dev local). En contenedor (QA/prod) ASPNETCORE_URLS define
// los binds y un reverse proxy (Caddy/nginx) termina TLS — no hardcodeamos los puertos
// ni intentamos cargar dev-cert.pfx.
var devCertPath = Path.Combine(Directory.GetCurrentDirectory(), "dev-cert.pfx");
var devCertPassword = builder.Configuration["DevCert:Password"] ?? "SmartMenuDev";
var inContainer = string.Equals(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"), "true", StringComparison.OrdinalIgnoreCase);
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 20_971_520; // 20 MB

    if (inContainer) return; // honra ASPNETCORE_URLS — Kestrel hace HTTP plano detrás del proxy

    serverOptions.ListenAnyIP(5041); // HTTP
    serverOptions.ListenAnyIP(5042, listenOptions =>
    {
        if (File.Exists(devCertPath))
            listenOptions.UseHttps(devCertPath, devCertPassword);
        else
            listenOptions.UseHttps(); // certificado .NET dev (solo localhost)
    });
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 20_971_520; // 20 MB
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

// ===== DATABASE =====
// S4.1 — IHttpContextAccessor + AuditInterceptor + AuditDbContext (DB separada).
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache(); // requerido por IdempotencyMiddleware (S4.4)
builder.Services.AddScoped<SmartMenu.API.Data.AuditInterceptor>();

builder.Services.AddDbContext<SmartMenu.Infrastructure.Data.AuditDbContext>(options =>
{
    var auditConn = builder.Configuration.GetConnectionString("AuditConnection")
        ?? builder.Configuration.GetConnectionString("DefaultConnection"); // fallback: misma DB si no se configura
    options.UseSqlServer(auditConn, b => b.MigrationsAssembly("SmartMenu.Infrastructure").MigrationsHistoryTable("__AuditMigrationsHistory"));
});

builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        b => b.MigrationsAssembly("SmartMenu.Infrastructure"));
    options.AddInterceptors(sp.GetRequiredService<SmartMenu.API.Data.AuditInterceptor>());
    options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
});

// ===== REDIS ===== (Comentado temporalmente - no crítico para MVP)
// builder.Services.AddStackExchangeRedisCache(options =>
// {
//     options.Configuration = builder.Configuration.GetConnectionString("Redis");
//     options.InstanceName = "SmartMenu_";
// });

// ===== JWT AUTHENTICATION =====
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["Secret"];

// Reject default placeholder in any non-Development environment
if (!builder.Environment.IsDevelopment() &&
    (string.IsNullOrWhiteSpace(secretKey) || secretKey.StartsWith("your-super-secret")))
{
    throw new InvalidOperationException(
        "JWT secret is missing or is the default placeholder. Set JwtSettings:Secret via environment variable or user-secrets before running outside Development.");
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

    // Para SignalR
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

// ===== RATE LIMITING =====
builder.Services.AddRateLimiter(options =>
{
    // Policy for /api/payment/validate-rnc/{rnc} — external DGII call, must be throttled
    options.AddFixedWindowLimiter("rnc", o =>
    {
        o.PermitLimit = 10;                 // 10 calls
        o.Window = TimeSpan.FromMinutes(1); // per minute
        o.QueueLimit = 0;                   // no queue, reject extras
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    // Global default — generous; specific policies override per-endpoint
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

// ===== CORS =====
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        policy.WithOrigins(origins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Para SignalR
    });
    // En desarrollo: permitir cualquier origen para probar desde el móvil (IP local)
    options.AddPolicy("AllowAllInDev", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// ===== REPOSITORIES =====
builder.Services.AddScoped(typeof(SmartMenu.Application.Repositories.IRepository<>), typeof(SmartMenu.Infrastructure.Repositories.Repository<>));
builder.Services.AddScoped<SmartMenu.Application.Repositories.IUserRepository, SmartMenu.Infrastructure.Repositories.UserRepository>();
builder.Services.AddScoped<SmartMenu.Application.Repositories.IOrderRepository, SmartMenu.Infrastructure.Repositories.OrderRepository>();

// ===== SETTINGS =====
builder.Services.Configure<SmartMenu.Application.Settings.BillingSettings>(
    builder.Configuration.GetSection(SmartMenu.Application.Settings.BillingSettings.SectionName));

// ===== SERVICES =====
builder.Services.AddScoped<SmartMenu.Application.Services.IAuthService, SmartMenu.Infrastructure.Services.AuthService>();
builder.Services.AddScoped<SmartMenu.Application.Services.IOrderService, SmartMenu.Infrastructure.Services.OrderService>();

// ===== HEALTH CHECKS =====
// /health/live   → liveness probe (sin checks, solo confirma que el proceso responde).
// /health/ready  → readiness probe (chequea DB) — usado por load balancers / k8s para
//                  saber si esta instancia puede recibir tráfico.
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>(
        name: "database",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "ready", "db" });

// ===== OPENTELEMETRY =====
// Traces + metrics instrumentación ASP.NET Core, EF Core (via DiagnosticSource),
// HttpClient y runtime (.NET GC, threadpool, etc.).
// Tracing: Console exporter en Dev (legible en logs). En prod añadir OTLP / Jaeger.
// Metrics: expuestas en /metrics (formato Prometheus) para scraping.
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r
        .AddService(serviceName: "SmartMenu.API", serviceVersion: "1.0.0")
        .AddAttributes(new[] { new KeyValuePair<string, object>("environment", builder.Environment.EnvironmentName) }))
    .WithTracing(t =>
    {
        t.AddAspNetCoreInstrumentation(o =>
        {
            // Ignorar /health/* y /metrics del tracing — son ruido constante.
            o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health")
                           && !ctx.Request.Path.StartsWithSegments("/metrics");
        })
         .AddHttpClientInstrumentation()
         .AddSource("Microsoft.EntityFrameworkCore"); // EF Core emite ActivitySource propio
        if (builder.Environment.IsDevelopment())
            t.AddConsoleExporter();
    })
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddPrometheusExporter());

// ===== SIGNALR =====
builder.Services.AddSignalR();

// ===== CONTROLLERS =====
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never;
        // Enums → string consistente ("Confirmed" en vez de 1). Cliente puede tipar uniones TS estables.
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();

// ===== SWAGGER =====
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

    // JWT en Swagger
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

// ===== MIDDLEWARE PIPELINE =====

// Serilog request logging — una línea por request con duración + status code.
// S1.5: NO loguear paths /hubs/* (donde el token JWT viaja como ?access_token=…) ni
// /metrics ni /health/* (ruido de scraping/probes). El template default de Serilog
// no incluye la QueryString, pero suprimimos el path entero para defensa en profundidad
// — si alguien sube el log level a Debug en framework, los hubs no se logueen.
app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
    opts.GetLevel = (httpCtx, _, _) =>
    {
        var p = httpCtx.Request.Path;
        if (p.StartsWithSegments("/hubs") || p.StartsWithSegments("/metrics") || p.StartsWithSegments("/health"))
            return Serilog.Events.LogEventLevel.Verbose; // sale por debajo de Information default
        return Serilog.Events.LogEventLevel.Information;
    };
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "SmartMenu API v1");
        c.RoutePrefix = string.Empty; // Swagger en la raíz
    });
}

// En producción redirige HTTP → HTTPS. En desarrollo no, porque el proxy
// de Next.js envía HTTP a localhost:5041 y la redirección rompe SignalR.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

var wwwRoot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwRoot))
    Directory.CreateDirectory(wwwRoot);
app.UseStaticFiles();

app.UseCors(app.Environment.IsDevelopment() ? "AllowAllInDev" : "AllowAll");

// Global exception handling — debe ir antes de Authentication para que
// también atrape excepciones del pipeline de auth.
app.UseMiddleware<SmartMenu.API.Middleware.ExceptionHandlingMiddleware>();

// S4.4 — Idempotency: solo aplica a POST/PUT/PATCH en /api/order y /api/payment.
// Si el header Idempotency-Key existe y ya se vio en 24h, retorna respuesta cacheada.
app.UseMiddleware<SmartMenu.API.Middleware.IdempotencyMiddleware>();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// SignalR Hubs
app.MapHub<SmartMenu.API.Hubs.OrderHub>("/hubs/orders");
app.MapHub<SmartMenu.API.Hubs.KitchenHub>("/hubs/kitchen");
app.MapHub<SmartMenu.API.Hubs.TableHub>("/hubs/tables");
app.MapHub<SmartMenu.API.Hubs.ReservationHub>("/hubs/reservations");

// ===== HEALTH ENDPOINTS =====
// Liveness — proceso vivo, no chequea dependencias. Para K8s liveness probe.
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = WriteHealthJson
});

// Readiness — chequea DB. Para K8s readiness probe / load balancer.
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = c => c.Tags.Contains("ready"),
    ResponseWriter = WriteHealthJson
});

// Legacy: ping simple (compat con código existente). No chequea nada.
app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    timestamp = DateTime.UtcNow,
    version = "1.0.0",
    environment = app.Environment.EnvironmentName
}));

// ===== PROMETHEUS METRICS =====
// Endpoint /metrics expone counters/histograms en formato Prometheus para scraping.
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

// Apply migrations + seed (solo en desarrollo). En producción `dotnet ef database update`
// debe correr externamente (CI/CD), siguiendo la mejor práctica de no auto-migrar prod.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // 1. Aplicar TODAS las migrations EF formales (incluye BackfillBlockBTanda5 idempotente).
    //    Antes había 12 Ensure*Async schema patches; todos quedan cubiertos por las migrations
    //    en SmartMenu.Infrastructure/Data/Migrations/.
    await context.Database.MigrateAsync();

    // 2. Seed inicial.
    await SmartMenu.Infrastructure.Data.DbInitializer.SeedAsync(context);

    // 3. Ensure de DATOS (no schema) — son seeders idempotentes para usuarios y tags
    //    históricos que no se mantienen en SeedAsync principal.
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureExtraWaiterAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureCashierAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureDishTagsSeedAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureBarUserAsync(context);
}

app.Run();
