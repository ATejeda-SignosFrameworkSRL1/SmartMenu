# 🔧 STACK .NET 9 - CONFIGURACIÓN DETALLADA

## **📋 STACK TECNOLÓGICO OFICIAL**

### **Frontend**
- ✅ **React 18+** - Framework frontend
- ✅ **TypeScript** - Type safety
- ✅ **@microsoft/signalr** - Cliente SignalR para React
- ✅ **Axios** - HTTP client
- ✅ **React Query** - Data fetching y cache

### **Backend**
- ✅ **.NET 9** - Framework principal
- ✅ **ASP.NET Core Web API** - APIs RESTful
- ✅ **Entity Framework Core** - ORM principal
- ✅ **SignalR** - Comunicación en tiempo real

### **Base de Datos**
- ✅ **SQL Server 2022** - Base de datos principal
- ✅ **Redis** - Cache distribuido

### **Infraestructura**
- ✅ **Docker** - Containerización
- ✅ **Azure** - Cloud hosting
- ✅ **IIS/Kestrel** - Web server

---

## **🏗️ ARQUITECTURA .NET 9**

### **Clean Architecture con .NET**

```
SmartMenu.Solution/
├── src/
│   ├── 1. Presentation/
│   │   ├── SmartMenu.API/              # Web API principal
│   │   └── SmartMenu.Gateway/          # API Gateway (Ocelot)
│   │
│   ├── 2. Application/
│   │   └── SmartMenu.Application/      # Lógica de aplicación
│   │       ├── DTOs/
│   │       ├── Interfaces/
│   │       ├── Services/
│   │       ├── Validators/
│   │       └── Mappers/
│   │
│   ├── 3. Domain/
│   │   └── SmartMenu.Domain/           # Entidades y lógica de negocio
│   │       ├── Entities/
│   │       ├── Enums/
│   │       ├── ValueObjects/
│   │       └── Interfaces/
│   │
│   ├── 4. Infrastructure/
│   │   ├── SmartMenu.Infrastructure/   # Implementaciones
│   │   │   ├── Data/
│   │   │   │   ├── ApplicationDbContext.cs
│   │   │   │   ├── Repositories/
│   │   │   │   └── Migrations/
│   │   │   ├── Services/
│   │   │   ├── Caching/
│   │   │   └── SignalR/
│   │   │       └── Hubs/
│   │   └── SmartMenu.Queries/         # Queries EF Core complejas
│   │       └── Specifications/
│   │
│   └── 5. Shared/
│       └── SmartMenu.Shared/           # Utilidades compartidas
│           ├── Constants/
│           ├── Extensions/
│           └── Helpers/
│
├── tests/
│   ├── SmartMenu.UnitTests/
│   ├── SmartMenu.IntegrationTests/
│   └── SmartMenu.E2ETests/
│
└── SmartMenu.sln
```

---

## **💾 ENTITY FRAMEWORK CORE - CONFIGURACIÓN**

### **DbContext Principal**

```csharp
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;

namespace SmartMenu.Infrastructure.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // DbSets
        public DbSet<User> Users { get; set; }
        public DbSet<Restaurant> Restaurants { get; set; }
        public DbSet<Table> Tables { get; set; }
        public DbSet<TableSession> TableSessions { get; set; }
        public DbSet<Menu> Menus { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Dish> Dishes { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<InventoryItem> InventoryItems { get; set; }
        public DbSet<Notification> Notifications { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Aplicar todas las configuraciones del assembly
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

            // Configuraciones globales
            ConfigureGlobalSettings(modelBuilder);
        }

        private void ConfigureGlobalSettings(ModelBuilder modelBuilder)
        {
            // Configurar decimales para precios
            foreach (var property in modelBuilder.Model.GetEntityTypes()
                .SelectMany(t => t.GetProperties())
                .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            {
                property.SetPrecision(18);
                property.SetScale(2);
            }

            // Configurar timestamps automáticos
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                if (typeof(IAuditableEntity).IsAssignableFrom(entityType.ClrType))
                {
                    modelBuilder.Entity(entityType.ClrType)
                        .Property<DateTime>("CreatedAt")
                        .HasDefaultValueSql("GETUTCDATE()");

                    modelBuilder.Entity(entityType.ClrType)
                        .Property<DateTime>("UpdatedAt")
                        .HasDefaultValueSql("GETUTCDATE()");
                }
            }
        }
    }
}
```

---

### **Entity Configuration con Fluent API**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartMenu.Domain.Entities;

namespace SmartMenu.Infrastructure.Data.Configurations
{
    public class DishConfiguration : IEntityTypeConfiguration<Dish>
    {
        public void Configure(EntityTypeBuilder<Dish> builder)
        {
            builder.ToTable("Dishes");

            builder.HasKey(d => d.Id);

            builder.Property(d => d.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(d => d.Description)
                .HasMaxLength(1000);

            builder.Property(d => d.Price)
                .HasPrecision(18, 2)
                .IsRequired();

            builder.Property(d => d.PreparationTime)
                .IsRequired();

            // JSON column para imágenes (SQL Server 2016+)
            builder.Property(d => d.Images)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions)null))
                .HasColumnType("nvarchar(max)");

            // JSON column para información nutricional
            builder.Property(d => d.NutritionalInfo)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null),
                    v => JsonSerializer.Deserialize<NutritionalInfo>(v, (JsonSerializerOptions)null))
                .HasColumnType("nvarchar(max)");

            // Relaciones
            builder.HasOne(d => d.Category)
                .WithMany(c => c.Dishes)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(d => d.Modifiers)
                .WithOne()
                .HasForeignKey("DishId")
                .OnDelete(DeleteBehavior.Cascade);

            // Índices
            builder.HasIndex(d => d.CategoryId);
            builder.HasIndex(d => d.Name);
            builder.HasIndex(d => d.IsAvailable);
            builder.HasIndex(d => new { d.IsAvailable, d.CategoryId });
        }
    }
}
```

---

### **Repository Pattern con Entity Framework**

```csharp
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Interfaces;
using System.Linq.Expressions;

namespace SmartMenu.Infrastructure.Data.Repositories
{
    public class Repository<T> : IRepository<T> where T : class
    {
        protected readonly ApplicationDbContext _context;
        protected readonly DbSet<T> _dbSet;

        public Repository(ApplicationDbContext context)
        {
            _context = context;
            _dbSet = context.Set<T>();
        }

        public async Task<T> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await _dbSet.FindAsync(new object[] { id }, cancellationToken);
        }

        public async Task<IEnumerable<T>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return await _dbSet.ToListAsync(cancellationToken);
        }

        public async Task<IEnumerable<T>> FindAsync(
            Expression<Func<T, bool>> predicate,
            CancellationToken cancellationToken = default)
        {
            return await _dbSet.Where(predicate).ToListAsync(cancellationToken);
        }

        public async Task<T> AddAsync(T entity, CancellationToken cancellationToken = default)
        {
            await _dbSet.AddAsync(entity, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
            return entity;
        }

        public async Task UpdateAsync(T entity, CancellationToken cancellationToken = default)
        {
            _dbSet.Update(entity);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteAsync(T entity, CancellationToken cancellationToken = default)
        {
            _dbSet.Remove(entity);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<bool> ExistsAsync(
            Expression<Func<T, bool>> predicate,
            CancellationToken cancellationToken = default)
        {
            return await _dbSet.AnyAsync(predicate, cancellationToken);
        }

        public async Task<int> CountAsync(
            Expression<Func<T, bool>> predicate = null,
            CancellationToken cancellationToken = default)
        {
            if (predicate == null)
                return await _dbSet.CountAsync(cancellationToken);
            
            return await _dbSet.CountAsync(predicate, cancellationToken);
        }
    }
}
```

---

## **⚡ ENTITY FRAMEWORK CORE - QUERIES AVANZADAS**

### **Queries Complejas con EF Core**

```csharp
using Microsoft.EntityFrameworkCore;
using SmartMenu.Application.DTOs;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Application.Services
{
    public interface IAnalyticsQueries
    {
        Task<SalesMetrics> GetSalesMetricsAsync(DateTime startDate, DateTime endDate);
        Task<IEnumerable<DishPerformance>> GetTopSellingDishesAsync(int topN);
        Task<IEnumerable<TableMetrics>> GetTableMetricsAsync(DateTime date);
    }

    public class AnalyticsQueries : IAnalyticsQueries
    {
        private readonly ApplicationDbContext _context;

        public AnalyticsQueries(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<SalesMetrics> GetSalesMetricsAsync(DateTime startDate, DateTime endDate)
        {
            var metrics = await _context.Orders
                .Where(o => o.CreatedAt >= startDate && 
                           o.CreatedAt <= endDate && 
                           o.Status == OrderStatus.Completed)
                .GroupBy(o => 1)
                .Select(g => new SalesMetrics
                {
                    TotalOrders = g.Count(),
                    TotalRevenue = g.Sum(o => o.Total),
                    AverageTicket = g.Average(o => o.Total),
                    UniqueTables = g.Select(o => o.TableId).Distinct().Count()
                })
                .FirstOrDefaultAsync();

            return metrics ?? new SalesMetrics();
        }

        public async Task<IEnumerable<DishPerformance>> GetTopSellingDishesAsync(int topN)
        {
            var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);

            return await _context.OrderItems
                .Include(oi => oi.Dish)
                .Include(oi => oi.Order)
                .Where(oi => oi.Order.Status == OrderStatus.Completed &&
                            oi.Order.CreatedAt >= thirtyDaysAgo)
                .GroupBy(oi => new { oi.DishId, oi.Dish.Name })
                .Select(g => new DishPerformance
                {
                    DishId = g.Key.DishId,
                    DishName = g.Key.Name,
                    OrderCount = g.Count(),
                    TotalQuantity = g.Sum(oi => oi.Quantity),
                    TotalRevenue = g.Sum(oi => oi.Quantity * oi.UnitPrice),
                    AveragePrice = g.Average(oi => oi.UnitPrice)
                })
                .OrderByDescending(d => d.TotalQuantity)
                .Take(topN)
                .ToListAsync();
        }

        public async Task<IEnumerable<TableMetrics>> GetTableMetricsAsync(DateTime date)
        {
            var startOfDay = date.Date;
            var endOfDay = startOfDay.AddDays(1);

            return await _context.Tables
                .Include(t => t.TableSessions)
                .Where(t => t.TableSessions.Any(ts => ts.StartTime >= startOfDay && 
                                                      ts.StartTime < endOfDay))
                .Select(t => new TableMetrics
                {
                    TableId = t.Id,
                    TableNumber = t.TableNumber,
                    Turnover = t.TableSessions.Count(ts => ts.StartTime >= startOfDay && 
                                                           ts.StartTime < endOfDay),
                    AverageDurationMinutes = t.TableSessions
                        .Where(ts => ts.StartTime >= startOfDay && 
                                   ts.StartTime < endOfDay &&
                                   ts.EndTime != null)
                        .Average(ts => EF.Functions.DateDiffMinute(ts.StartTime, ts.EndTime)),
                    CompletionRate = (double)t.TableSessions
                        .Count(ts => ts.StartTime >= startOfDay && 
                                   ts.StartTime < endOfDay &&
                                   ts.Status == SessionStatus.Paid) / 
                                   t.TableSessions.Count(ts => ts.StartTime >= startOfDay && 
                                                              ts.StartTime < endOfDay) * 100
                })
                .OrderByDescending(tm => tm.Turnover)
                .ToListAsync();
        }
    }
}
```

---

### **Stored Procedures con EF Core**

```csharp
public class OrderQueries : IOrderQueries
{
    private readonly ApplicationDbContext _context;

    public OrderQueries(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<OrderDetailDto> GetOrderWithDetailsAsync(int orderId)
    {
        // Opción 1: Eager Loading con Include
        var order = await _context.Orders
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
            .Include(o => o.Table)
            .Include(o => o.TableSession)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null)
            return null;

        return new OrderDetailDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            TableId = order.TableId,
            TableNumber = order.Table.TableNumber,
            Items = order.Items.Select(i => new OrderItemDto
            {
                Id = i.Id,
                DishId = i.DishId,
                DishName = i.Dish.Name,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice
            }).ToList()
        };
    }

    // Opción 2: Llamar Stored Procedure con EF Core
    public async Task<OrderDetailDto> GetOrderWithDetailsFromSPAsync(int orderId)
    {
        var result = await _context.Set<OrderDetailDto>()
            .FromSqlRaw("EXEC sp_GetOrderWithDetails @OrderId = {0}", orderId)
            .ToListAsync();

        return result.FirstOrDefault();
    }

    public async Task<int> CreateOrderWithItemsAsync(CreateOrderDto orderDto)
    {
        // Usar transacción de EF Core
        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var order = new Order
            {
                TableId = orderDto.TableId,
                SessionId = orderDto.SessionId,
                Status = OrderStatus.Pending,
                Subtotal = orderDto.Subtotal,
                Tax = orderDto.Tax,
                Total = orderDto.Total,
                CreatedAt = DateTime.UtcNow
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            foreach (var itemDto in orderDto.Items)
            {
                var orderItem = new OrderItem
                {
                    OrderId = order.Id,
                    DishId = itemDto.DishId,
                    Quantity = itemDto.Quantity,
                    UnitPrice = itemDto.UnitPrice,
                    Status = ItemStatus.Pending
                };

                _context.OrderItems.Add(orderItem);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return order.Id;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
```

---

## **📡 SIGNALR - COMUNICACIÓN EN TIEMPO REAL**

### **Hub Configuration**

```csharp
using Microsoft.AspNetCore.SignalR;
using SmartMenu.Application.DTOs;

namespace SmartMenu.Infrastructure.SignalR.Hubs
{
    public class OrderHub : Hub
    {
        private readonly IOrderService _orderService;
        private readonly ILogger<OrderHub> _logger;

        public OrderHub(IOrderService orderService, ILogger<OrderHub> logger)
        {
            _orderService = orderService;
            _logger = logger;
        }

        // Cliente se une a un grupo de mesa
        public async Task JoinTableGroup(int tableId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"table_{tableId}");
            _logger.LogInformation($"Connection {Context.ConnectionId} joined table_{tableId}");
        }

        // Cliente sale del grupo de mesa
        public async Task LeaveTableGroup(int tableId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"table_{tableId}");
            _logger.LogInformation($"Connection {Context.ConnectionId} left table_{tableId}");
        }

        // Mesero se une al grupo de su zona
        public async Task JoinWaiterZone(int zoneId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"zone_{zoneId}");
        }

        // Cocina se une al grupo de cocina
        public async Task JoinKitchen()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "kitchen");
        }

        // Métodos llamados desde el cliente
        public async Task SendOrderUpdate(int orderId, string status)
        {
            var order = await _orderService.GetByIdAsync(orderId);
            
            // Notificar a la mesa
            await Clients.Group($"table_{order.TableId}")
                .SendAsync("OnOrderStatusChanged", new
                {
                    OrderId = orderId,
                    Status = status,
                    Timestamp = DateTime.UtcNow
                });

            // Notificar al mesero
            await Clients.Group($"zone_{order.Table.ZoneId}")
                .SendAsync("OnOrderUpdated", order);
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation($"Client connected: {Context.ConnectionId}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            _logger.LogInformation($"Client disconnected: {Context.ConnectionId}");
            await base.OnDisconnectedAsync(exception);
        }
    }

    // Hub para cocina
    public class KitchenHub : Hub
    {
        public async Task JoinKitchenStation(string stationType)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"station_{stationType}");
        }

        public async Task OrderReady(int orderId, int tableId)
        {
            // Notificar a meseros
            await Clients.Group($"zone_all")
                .SendAsync("OnOrderReady", new
                {
                    OrderId = orderId,
                    TableId = tableId,
                    Timestamp = DateTime.UtcNow
                });

            // Notificar a cliente
            await Clients.Group($"table_{tableId}")
                .SendAsync("OnOrderReady", new
                {
                    Message = "¡Tu pedido está listo!",
                    OrderId = orderId
                });
        }
    }
}
```

---

### **SignalR Service para enviar notificaciones**

```csharp
using Microsoft.AspNetCore.SignalR;
using SmartMenu.Infrastructure.SignalR.Hubs;

namespace SmartMenu.Application.Services
{
    public interface INotificationService
    {
        Task NotifyOrderCreated(int orderId, int tableId);
        Task NotifyOrderStatusChanged(int orderId, string status);
        Task NotifyWaiterCalled(int tableId);
        Task NotifyOrderReady(int orderId, int tableId);
    }

    public class NotificationService : INotificationService
    {
        private readonly IHubContext<OrderHub> _orderHub;
        private readonly IHubContext<KitchenHub> _kitchenHub;

        public NotificationService(
            IHubContext<OrderHub> orderHub,
            IHubContext<KitchenHub> kitchenHub)
        {
            _orderHub = orderHub;
            _kitchenHub = kitchenHub;
        }

        public async Task NotifyOrderCreated(int orderId, int tableId)
        {
            // Notificar a cocina
            await _kitchenHub.Clients.Group("kitchen")
                .SendAsync("OnNewOrder", new
                {
                    OrderId = orderId,
                    TableId = tableId,
                    Timestamp = DateTime.UtcNow
                });

            // Notificar a cliente
            await _orderHub.Clients.Group($"table_{tableId}")
                .SendAsync("OnOrderConfirmed", new
                {
                    OrderId = orderId,
                    Message = "Tu pedido ha sido confirmado"
                });
        }

        public async Task NotifyOrderStatusChanged(int orderId, string status)
        {
            await _orderHub.Clients.All
                .SendAsync("OnOrderStatusChanged", new
                {
                    OrderId = orderId,
                    Status = status,
                    Timestamp = DateTime.UtcNow
                });
        }

        public async Task NotifyWaiterCalled(int tableId)
        {
            // Obtener zona de la mesa y notificar meseros de esa zona
            await _orderHub.Clients.Group($"zone_all")
                .SendAsync("OnWaiterCalled", new
                {
                    TableId = tableId,
                    Timestamp = DateTime.UtcNow
                });
        }

        public async Task NotifyOrderReady(int orderId, int tableId)
        {
            await _orderHub.Clients.Group($"table_{tableId}")
                .SendAsync("OnOrderReady", new
                {
                    OrderId = orderId,
                    Message = "¡Tu pedido está listo! El mesero lo traerá pronto."
                });
        }
    }
}
```

---

## **⚙️ PROGRAM.CS - CONFIGURACIÓN COMPLETA**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Infrastructure.SignalR.Hubs;
using System.Text;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Entity Framework
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null);
            sqlOptions.CommandTimeout(30);
        }
    ));

// Queries Services (EF Core)
builder.Services.AddScoped<IAnalyticsQueries, AnalyticsQueries>();
builder.Services.AddScoped<IOrderQueries, OrderQueries>();

// Redis Cache
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "SmartMenu_";
});

// Redis for SignalR backplane
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = ConfigurationOptions.Parse(
        builder.Configuration.GetConnectionString("Redis"),
        true);
    return ConnectionMultiplexer.Connect(configuration);
});

// SignalR with Redis backplane (for scaling)
builder.Services.AddSignalR()
    .AddStackExchangeRedis(builder.Configuration.GetConnectionString("Redis"), options =>
    {
        options.Configuration.ChannelPrefix = "SmartMenu";
    });

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var key = Encoding.ASCII.GetBytes(jwtSettings["Secret"]);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    // Para SignalR con JWT
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

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:3001")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Importante para SignalR
    });
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SmartMenu API",
        Version = "v1",
        Description = "API para el sistema Smart Menu"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
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

// Application Services
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IMenuService, MenuService>();
builder.Services.AddScoped<ITableService, TableService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<INotificationService, NotificationService>();

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Health Checks
builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
    .AddRedis(builder.Configuration.GetConnectionString("Redis"));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// SignalR Hubs
app.MapHub<OrderHub>("/hubs/orders");
app.MapHub<KitchenHub>("/hubs/kitchen");
app.MapHub<NotificationHub>("/hubs/notifications");

// Health checks
app.MapHealthChecks("/health");

app.Run();
```

---

## **🔌 REACT + SIGNALR - CLIENTE**

### **Instalación**

```bash
npm install @microsoft/signalr
```

### **SignalR Service en React**

```typescript
// services/signalr/SignalRService.ts
import * as signalR from '@microsoft/signalr';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(hubUrl: string, accessToken?: string): Promise<void> {
    const options: signalR.IHttpConnectionOptions = {
      accessTokenFactory: () => accessToken || '',
      transport: signalR.HttpTransportType.WebSockets,
      skipNegotiation: true
    };

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, options)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount >= this.maxReconnectAttempts) {
            return null; // Stop reconnecting
          }
          // Exponential backoff
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Event handlers
    this.connection.onreconnecting((error) => {
      console.warn('SignalR reconnecting...', error);
    });

    this.connection.onreconnected((connectionId) => {
      console.log('SignalR reconnected:', connectionId);
      this.reconnectAttempts = 0;
    });

    this.connection.onclose((error) => {
      console.error('SignalR connection closed:', error);
    });

    try {
      await this.connection.start();
      console.log('SignalR connected');
    } catch (error) {
      console.error('Error connecting to SignalR:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  on(methodName: string, callback: (...args: any[]) => void): void {
    if (this.connection) {
      this.connection.on(methodName, callback);
    }
  }

  off(methodName: string, callback: (...args: any[]) => void): void {
    if (this.connection) {
      this.connection.off(methodName, callback);
    }
  }

  async invoke(methodName: string, ...args: any[]): Promise<any> {
    if (this.connection) {
      return await this.connection.invoke(methodName, ...args);
    }
  }

  getState(): signalR.HubConnectionState {
    return this.connection?.state || signalR.HubConnectionState.Disconnected;
  }
}

export const signalRService = new SignalRService();
```

### **Hook de React para SignalR**

```typescript
// hooks/useSignalR.ts
import { useEffect, useState } from 'react';
import { signalRService } from '../services/signalr/SignalRService';
import { HubConnectionState } from '@microsoft/signalr';

export const useSignalR = (hubUrl: string, accessToken?: string) => {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        await signalRService.connect(hubUrl, accessToken);
        if (mounted) {
          setConnected(true);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setConnected(false);
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      signalRService.disconnect();
    };
  }, [hubUrl, accessToken]);

  const on = (methodName: string, callback: (...args: any[]) => void) => {
    signalRService.on(methodName, callback);
  };

  const off = (methodName: string, callback: (...args: any[]) => void) => {
    signalRService.off(methodName, callback);
  };

  const invoke = async (methodName: string, ...args: any[]) => {
    return await signalRService.invoke(methodName, ...args);
  };

  return { connected, error, on, off, invoke };
};
```

### **Componente que usa SignalR**

```typescript
// components/OrderTracking.tsx
import React, { useEffect, useState } from 'react';
import { useSignalR } from '../hooks/useSignalR';

interface OrderStatus {
  orderId: number;
  status: string;
  timestamp: string;
}

export const OrderTracking: React.FC<{ tableId: number }> = ({ tableId }) => {
  const { connected, on, off, invoke } = useSignalR(
    'https://api.smartmenu.com/hubs/orders',
    localStorage.getItem('accessToken') || undefined
  );

  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);

  useEffect(() => {
    if (!connected) return;

    // Unirse al grupo de la mesa
    invoke('JoinTableGroup', tableId);

    // Escuchar eventos
    const handleOrderStatusChanged = (data: OrderStatus) => {
      console.log('Order status changed:', data);
      setOrderStatus(data);
    };

    const handleOrderReady = (data: any) => {
      console.log('Order ready:', data);
      // Mostrar notificación
    };

    on('OnOrderStatusChanged', handleOrderStatusChanged);
    on('OnOrderReady', handleOrderReady);

    // Cleanup
    return () => {
      off('OnOrderStatusChanged', handleOrderStatusChanged);
      off('OnOrderReady', handleOrderReady);
      invoke('LeaveTableGroup', tableId);
    };
  }, [connected, tableId]);

  if (!connected) {
    return <div>Conectando...</div>;
  }

  return (
    <div>
      <h3>Estado del Pedido</h3>
      {orderStatus && (
        <div>
          <p>Pedido #{orderStatus.orderId}</p>
          <p>Estado: {orderStatus.status}</p>
          <p>Actualizado: {new Date(orderStatus.timestamp).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
};
```

---

**Fecha de Creación:** 6 de Febrero, 2026  
**Versión:** 1.0  
**Stack:** .NET 9 + React + SQL Server + SignalR + Entity Framework Core
