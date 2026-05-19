using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Threading.RateLimiting;
using SmartMenu.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// HTTP 5041 + HTTPS 5042. Para evitar ERR_CERT_COMMON_NAME_INVALID en https://TU_IP:5042, ejecuta: .\scripts\create-dev-cert.ps1
var devCertPath = Path.Combine(Directory.GetCurrentDirectory(), "dev-cert.pfx");
var devCertPassword = builder.Configuration["DevCert:Password"] ?? "SmartMenuDev";
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 20_971_520; // 20 MB
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
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        b => b.MigrationsAssembly("SmartMenu.Infrastructure"));
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

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// SignalR Hubs
app.MapHub<SmartMenu.API.Hubs.OrderHub>("/hubs/orders");
app.MapHub<SmartMenu.API.Hubs.KitchenHub>("/hubs/kitchen");
app.MapHub<SmartMenu.API.Hubs.TableHub>("/hubs/tables");
app.MapHub<SmartMenu.API.Hubs.ReservationHub>("/hubs/reservations");

// Health Check
app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    timestamp = DateTime.UtcNow,
    version = "1.0.0",
    environment = app.Environment.EnvironmentName
}));

// Apply migrations and seed database (solo en desarrollo)
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // 1. Apply all EF migrations first
    await context.Database.MigrateAsync();

    // 2. Add extra columns/tables not covered by EF migrations (idempotent, must run before seed)
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureMigrationAddVirtualTableTransferDishTagsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureZoneTypeColumnsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureOrderServedColumnsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureKitchenZoneColumnsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureCourseTimingColumnsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureAdvanceBlockAndSourceColumnsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureFiscalReceiptColumnsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureDishImagesTableAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureWaiterShiftsTableAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureReservationPreOrderTablesAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureConcurrencyAndSoftDeleteColumnsAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureTanda5DbObjectsAsync(context);

    // 3. Seed initial data
    await SmartMenu.Infrastructure.Data.DbInitializer.SeedAsync(context);

    // 4. Ensure additional users and data
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureExtraWaiterAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureCashierAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureDishTagsSeedAsync(context);
    await SmartMenu.Infrastructure.Data.DbInitializer.EnsureBarUserAsync(context);
}

app.Run();
