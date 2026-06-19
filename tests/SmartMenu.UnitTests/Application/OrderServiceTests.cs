using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Repositories;
using SmartMenu.Application.Settings;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Infrastructure.Services;

namespace SmartMenu.UnitTests.Application;

/// <summary>
/// S1.D2 — OrderService: state machine + server-side pricing + P0.2 fiscal guard.
/// Usa EFCore InMemory para ApplicationDbContext y Mock para IOrderRepository.
/// </summary>
public class OrderServiceTests
{
    private static ApplicationDbContext NewDb()
    {
        var opts = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(opts);
    }

    private static IOptions<BillingSettings> DefaultBilling() =>
        Options.Create(new BillingSettings { TaxRate = 0.18m, TipRate = 0.10m, IsrOnTipRate = 0.10m });

    private static (OrderService svc, Mock<IOrderRepository> repo, ApplicationDbContext db) Build(
        BillingSettings? billing = null)
    {
        var db = NewDb();
        var repo = new Mock<IOrderRepository>();
        var svc = new OrderService(
            repo.Object,
            db,
            NullLogger<OrderService>.Instance,
            Options.Create(billing ?? new BillingSettings()));
        return (svc, repo, db);
    }

    private static Dish SeedDish(ApplicationDbContext db, int id = 1, string name = "Pollo Asado", decimal price = 100m)
    {
        var dish = new Dish { Id = id, Name = name, Price = price, IsAvailable = true };
        db.Dishes.Add(dish);
        db.SaveChanges();
        return dish;
    }

    private static Table SeedTable(ApplicationDbContext db, int id = 1)
    {
        var t = new Table { Id = id, TableNumber = id, QRCode = $"qr-{id}", Status = TableStatus.Available };
        db.Tables.Add(t);
        db.SaveChanges();
        return t;
    }

    // ─── CreateOrderAsync ──────────────────────────────────────────────────
    [Fact]
    public async Task CreateOrder_with_invalid_table_throws_ArgumentException()
    {
        var (svc, _, _) = Build();
        var dto = new CreateOrderDto
        {
            TableId = 9999,
            SessionId = "s1",
            Items = new() { new CreateOrderItemDto { DishId = 1, Quantity = 1 } }
        };
        var act = () => svc.CreateOrderAsync(dto);
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*mesa*");
    }

    [Fact]
    public async Task CreateOrder_with_missing_dish_throws_ArgumentException()
    {
        var (svc, _, db) = Build();
        SeedTable(db);
        var dto = new CreateOrderDto
        {
            TableId = 1, SessionId = "s1",
            Items = new() { new CreateOrderItemDto { DishId = 999, Quantity = 1 } }
        };
        var act = () => svc.CreateOrderAsync(dto);
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Platos no encontrados*");
    }

    [Fact]
    public async Task CreateOrder_uses_server_side_pricing_ignoring_client_UnitPrice()
    {
        var (svc, repo, db) = Build();
        SeedTable(db);
        SeedDish(db, id: 1, price: 250m);

        Order? captured = null;
        repo.Setup(r => r.AddAsync(It.IsAny<Order>(), default))
            .Callback<Order, CancellationToken>((o, _) => { captured = o; o.Id = 100; })
            .ReturnsAsync((Order o, CancellationToken _) => o);
        repo.Setup(r => r.GetByIdWithItemsAsync(100, default))
            .ReturnsAsync(() => captured!);

        var dto = new CreateOrderDto
        {
            TableId = 1, SessionId = "s1",
            Items = new() { new CreateOrderItemDto
            {
                DishId = 1, Quantity = 2,
                UnitPrice = 0.01m, // intento de manipulación cliente
            } }
        };

        await svc.CreateOrderAsync(dto);

        captured.Should().NotBeNull();
        captured!.Items.Should().HaveCount(1);
        captured.Items.First().UnitPrice.Should().Be(250m); // del catálogo, NO del cliente
        captured.Items.First().Subtotal.Should().Be(500m);  // 250 * 2
    }

    [Fact]
    public async Task CreateOrder_computes_totals_with_18percent_tax_and_10percent_tip()
    {
        var billing = new BillingSettings { TaxRate = 0.18m, TipRate = 0.10m };
        var (svc, repo, db) = Build(billing);
        SeedTable(db);
        SeedDish(db, id: 1, price: 1000m);

        Order? captured = null;
        repo.Setup(r => r.AddAsync(It.IsAny<Order>(), default))
            .Callback<Order, CancellationToken>((o, _) => { captured = o; o.Id = 1; })
            .ReturnsAsync((Order o, CancellationToken _) => o);
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default)).ReturnsAsync(() => captured!);

        await svc.CreateOrderAsync(new CreateOrderDto
        {
            TableId = 1, SessionId = "s",
            Items = new() { new CreateOrderItemDto { DishId = 1, Quantity = 1 } }
        });

        captured!.Subtotal.Should().Be(1000m);
        captured.Tax.Should().Be(180m);   // 18 %
        captured.Tip.Should().Be(100m);   // 10 %
        captured.Total.Should().Be(1280m);
    }

    [Fact]
    public async Task CreateOrder_without_TableId_marks_as_pickup()
    {
        var (svc, repo, db) = Build();
        SeedDish(db, id: 1);

        Order? captured = null;
        repo.Setup(r => r.AddAsync(It.IsAny<Order>(), default))
            .Callback<Order, CancellationToken>((o, _) => { captured = o; o.Id = 50; })
            .ReturnsAsync((Order o, CancellationToken _) => o);
        repo.Setup(r => r.GetByIdWithItemsAsync(50, default)).ReturnsAsync(() => captured!);

        await svc.CreateOrderAsync(new CreateOrderDto
        {
            TableId = null, // explícito: pickup/POS
            SessionId = "pos-1",
            Items = new() { new CreateOrderItemDto { DishId = 1, Quantity = 1 } }
        });

        captured!.IsPickup.Should().BeTrue();
        captured.TableId.Should().BeNull();
    }

    [Fact]
    public async Task CreateOrder_with_quantity_zero_throws()
    {
        var (svc, repo, db) = Build();
        SeedTable(db);
        SeedDish(db, id: 1);

        var dto = new CreateOrderDto
        {
            TableId = 1, SessionId = "s",
            Items = new() { new CreateOrderItemDto { DishId = 1, Quantity = 0 } }
        };
        var act = () => svc.CreateOrderAsync(dto);
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Cantidad inválida*");
    }

    [Fact]
    public async Task CreateOrder_generates_unique_OrderNumber_with_ORD_prefix()
    {
        var (svc, repo, db) = Build();
        SeedTable(db);
        SeedDish(db, id: 1);

        Order? captured = null;
        repo.Setup(r => r.AddAsync(It.IsAny<Order>(), default))
            .Callback<Order, CancellationToken>((o, _) => { captured = o; o.Id = 7; })
            .ReturnsAsync((Order o, CancellationToken _) => o);
        repo.Setup(r => r.GetByIdWithItemsAsync(7, default)).ReturnsAsync(() => captured!);

        await svc.CreateOrderAsync(new CreateOrderDto
        {
            TableId = 1, SessionId = "s",
            Items = new() { new CreateOrderItemDto { DishId = 1, Quantity = 1 } }
        });

        captured!.OrderNumber.Should().StartWith("ORD-");
    }

    // ─── State machine (UpdateOrderStatusAsync, S4.5) ──────────────────────
    private static async Task<Order> SeedOrder(ApplicationDbContext db, OrderStatus status, decimal total = 100m)
    {
        var dish = new Dish { Id = 1, Name = "Pollo", Price = total, IsAvailable = true };
        db.Dishes.Add(dish);
        var order = new Order
        {
            Id = 1, OrderNumber = "ORD-T", SessionId = "s",
            Subtotal = total, Tax = 0m, Tip = 0m, Total = total,
            Status = status, IsPickup = true,
            Items = new List<OrderItem>
            {
                new OrderItem { Id = 1, DishId = 1, Dish = dish, Quantity = 1, UnitPrice = total, Subtotal = total }
            }
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return order;
    }

    [Fact]
    public async Task UpdateOrderStatus_valid_transition_Pending_to_Confirmed_succeeds()
    {
        var (svc, repo, db) = Build();
        await SeedOrder(db, OrderStatus.Pending);
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default))
            .ReturnsAsync(await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == 1));

        var act = () => svc.UpdateOrderStatusAsync(1, "Confirmed");
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UpdateOrderStatus_invalid_transition_Pending_to_Ready_throws()
    {
        var (svc, _, db) = Build();
        await SeedOrder(db, OrderStatus.Pending);

        var act = () => svc.UpdateOrderStatusAsync(1, "Ready");
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Transición de estado inválida*");
    }

    [Fact]
    public async Task UpdateOrderStatus_AdminOverride_bypasses_state_machine()
    {
        var (svc, repo, db) = Build();
        await SeedOrder(db, OrderStatus.Pending);
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default))
            .ReturnsAsync(await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == 1));

        // Pending → Ready normalmente prohibido, pero Admin lo permite.
        var act = () => svc.UpdateOrderStatusAsync(1, "Ready", isAdminOverride: true);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UpdateOrderStatus_Cancelled_always_allowed_from_any_state()
    {
        var (svc, repo, db) = Build();
        await SeedOrder(db, OrderStatus.Preparing);
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default))
            .ReturnsAsync(await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == 1));

        var act = () => svc.UpdateOrderStatusAsync(1, "Cancelled");
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UpdateOrderStatus_unknown_status_silently_ignored()
    {
        // Si el string no parsea a OrderStatus, no throws — solo no actualiza (defensivo).
        var (svc, repo, db) = Build();
        await SeedOrder(db, OrderStatus.Pending);
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default))
            .ReturnsAsync(await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == 1));

        var act = () => svc.UpdateOrderStatusAsync(1, "InvalidGarbage");
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UpdateOrderStatus_NotFound_throws_KeyNotFound()
    {
        var (svc, _, _) = Build();
        var act = () => svc.UpdateOrderStatusAsync(999, "Confirmed");
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ─── P0.2 fiscal guard: no Completed sin Payment ───────────────────────
    [Fact]
    public async Task UpdateOrderStatus_Completed_without_Payment_throws_fiscal_guard()
    {
        var (svc, _, db) = Build();
        await SeedOrder(db, OrderStatus.Served, total: 1500m);
        // No hay pagos en db.Payments → falta cobrar todo.

        var act = () => svc.UpdateOrderStatusAsync(1, "Completed");
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*sin cobro*");
    }

    [Fact]
    public async Task UpdateOrderStatus_Completed_with_Payment_succeeds()
    {
        var (svc, repo, db) = Build();
        await SeedOrder(db, OrderStatus.Served, total: 500m);
        db.Payments.Add(new Payment
        {
            Id = 1, OrderId = 1, Amount = 500m,
            Status = PaymentStatus.Completed, Method = "Cash"
        });
        await db.SaveChangesAsync();
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default))
            .ReturnsAsync(await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == 1));

        var act = () => svc.UpdateOrderStatusAsync(1, "Completed");
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UpdateOrderStatus_Completed_AdminOverride_without_reason_throws()
    {
        var (svc, _, db) = Build();
        await SeedOrder(db, OrderStatus.Served, total: 100m);

        var act = () => svc.UpdateOrderStatusAsync(1, "Completed", isAdminOverride: true, overrideReason: "");
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*OverrideReason*");
    }

    [Fact]
    public async Task UpdateOrderStatus_Completed_AdminOverride_with_reason_succeeds_and_audits()
    {
        var (svc, repo, db) = Build();
        await SeedOrder(db, OrderStatus.Served, total: 100m);
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default))
            .ReturnsAsync(await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == 1));

        var act = () => svc.UpdateOrderStatusAsync(1, "Completed",
            isAdminOverride: true, overrideReason: "Cliente se fue sin pagar, registrado en libro");
        await act.Should().NotThrowAsync();
    }

    // ─── CancelOrderAsync ──────────────────────────────────────────────────
    [Fact]
    public async Task CancelOrder_Pending_succeeds()
    {
        var (svc, repo, db) = Build();
        await SeedOrder(db, OrderStatus.Pending);
        repo.Setup(r => r.GetByIdWithItemsAsync(1, default))
            .ReturnsAsync(await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == 1));

        var act = () => svc.CancelOrderAsync(1, "cliente cambió de opinión");
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task CancelOrder_Preparing_throws_to_protect_kitchen()
    {
        var (svc, _, db) = Build();
        await SeedOrder(db, OrderStatus.Preparing);

        var act = () => svc.CancelOrderAsync(1, "tardío");
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*no se puede cancelar*");
    }

    [Fact]
    public async Task CancelOrder_NotFound_throws()
    {
        var (svc, _, _) = Build();
        var act = () => svc.CancelOrderAsync(404, "n/a");
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ─── AssignWaiterAsync ─────────────────────────────────────────────────
    [Fact]
    public async Task AssignWaiter_with_unknown_waiterId_throws_with_relogin_hint()
    {
        var (svc, _, db) = Build();
        await SeedOrder(db, OrderStatus.Pending);
        // No hay user con Id 999 en db.Users

        var act = () => svc.AssignWaiterAsync(1, 999);
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Cierra sesión*");
    }

    [Fact]
    public async Task AssignWaiter_sets_order_to_Confirmed()
    {
        var (svc, _, db) = Build();
        var order = await SeedOrder(db, OrderStatus.Pending);
        order.TableId = 1;
        db.Tables.Add(new Table { Id = 1, TableNumber = 1, QRCode = "qr-1", Status = TableStatus.Available });
        db.Users.Add(new User { Id = 5, Email = "w@x.com", FirstName = "W", LastName = "X", Role = UserRole.Waiter, IsActive = true });
        await db.SaveChangesAsync();

        await svc.AssignWaiterAsync(1, 5);

        var reloaded = await db.Orders.FirstAsync(o => o.Id == 1);
        reloaded.AssignedWaiterId.Should().Be(5);
        reloaded.Status.Should().Be(OrderStatus.Confirmed);
    }

    // ─── MarkCustomerFinishedAsync ─────────────────────────────────────────
    [Fact]
    public async Task MarkCustomerFinished_sets_flag_and_timestamp()
    {
        var (svc, repo, db) = Build();
        var order = await SeedOrder(db, OrderStatus.Served);
        repo.Setup(r => r.GetByIdAsync(1, default)).ReturnsAsync(order);

        await svc.MarkCustomerFinishedAsync(1);

        order.CustomerFinishedEating.Should().BeTrue();
        order.FinishedEatingAt.Should().NotBeNull();
    }
}
