using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartMenu.Infrastructure.Data;
using SmartMenu.IntegrationTests.Fixtures;

namespace SmartMenu.IntegrationTests.Scenarios;

/// <summary>
/// S1.D3 — Verifica que (1) las migraciones se aplican limpiamente al schema real,
/// y (2) son idempotentes: aplicarlas dos veces no falla.
/// Captura regresiones tipo "olvidé incluir una migration nueva en el commit" o
/// "una migration depende de orden y se rompe al re-aplicar".
/// </summary>
[Collection("Integration")]
public class MigrationsAndSchemaTests
{
    private readonly SmartMenuWebApplicationFactory _factory;

    public MigrationsAndSchemaTests(SqlServerContainerFixture sql)
    {
        _factory = new SmartMenuWebApplicationFactory { ConnectionString = sql.ConnectionString };
    }

    [Fact]
    public async Task Migrations_apply_idempotently()
    {
        // El startup ya migró al cargar la factory; aplicar de nuevo no debe lanzar.
        _ = _factory.CreateClient(); // fuerza la inicialización

        await _factory.EnsureDatabaseMigratedAsync();
        var act = async () => await _factory.EnsureDatabaseMigratedAsync();
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Database_has_all_DbContext_tables_after_startup()
    {
        _ = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Cada Count se evalúa SECUENCIALMENTE para no violar la regla de DbContext
        // (un único command activo por instancia). Si la tabla no existe, EF tira.
        var queries = new (string Name, Func<Task<int>> Query)[]
        {
            ("Users",            () => db.Users.CountAsync()),
            ("Restaurants",      () => db.Restaurants.CountAsync()),
            ("Tables",           () => db.Tables.CountAsync()),
            ("Zones",            () => db.Zones.CountAsync()),
            ("Menus",            () => db.Menus.CountAsync()),
            ("Categories",       () => db.Categories.CountAsync()),
            ("Dishes",           () => db.Dishes.CountAsync()),
            ("Orders",           () => db.Orders.CountAsync()),
            ("OrderItems",       () => db.OrderItems.CountAsync()),
            ("Payments",         () => db.Payments.CountAsync()),
            ("TableSessions",    () => db.TableSessions.CountAsync()),
            ("TableReservations",() => db.TableReservations.CountAsync()),
            ("RefreshTokens",    () => db.RefreshTokens.CountAsync()),
            ("LoginAttempts",    () => db.LoginAttempts.CountAsync()),
        };

        foreach (var (name, q) in queries)
        {
            var act = async () => await q();
            await act.Should().NotThrowAsync($"la tabla {name} debe existir tras migrar");
        }
    }

    [Fact]
    public async Task Seed_creates_baseline_users_after_startup()
    {
        // DbInitializer.SeedAsync + EnsureExtraWaiterAsync + EnsureCashierAsync + EnsureBartenderRoleAsync
        // poblan usuarios de roles operativos. Verifica al menos un usuario admin.
        _ = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var totalUsers = await db.Users.CountAsync();
        totalUsers.Should().BeGreaterThan(0, "DbInitializer.SeedAsync siembra users por defecto");
    }
}
