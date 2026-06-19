using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.IntegrationTests.Fixtures;

/// <summary>
/// S1.D3 — Bootea la API real contra un container SQL Server temporal. El connection
/// string viene del <see cref="SqlServerContainerFixture"/> que el test inyecta tras
/// construir la factory.
///
/// Environment forzado a Development → DbInitializer.SeedAsync corre + migrations
/// se aplican (verifica idempotencia y schema real al menos una vez).
/// </summary>
public class SmartMenuWebApplicationFactory : WebApplicationFactory<Program>
{
    public string ConnectionString { get; init; } = string.Empty;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(Environments.Development);

        builder.ConfigureAppConfiguration((_, config) =>
        {
            // Solo override de la connection string. JwtSettings hereda de appsettings.json
            // — overridearlos puede caer en condiciones de carrera entre el momento que
            // AuthService captura el secret (RegisterAsync) y el momento que JwtBearer lo
            // captura (Program.cs línea 97); usar el mismo valor para ambos garantiza match.
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = ConnectionString,
            });
        });
    }

    /// <summary>Aplica migraciones explícitamente y devuelve un scope con DbContext fresco.</summary>
    public async Task EnsureDatabaseMigratedAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();
    }
}
