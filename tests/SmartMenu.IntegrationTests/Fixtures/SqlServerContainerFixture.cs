using Testcontainers.MsSql;

namespace SmartMenu.IntegrationTests.Fixtures;

/// <summary>
/// S1.D3 — Fixture compartida que arranca un container SQL Server 2022 antes de la
/// collection y lo detiene al final. Una sola instancia para todos los tests evita
/// pagar el costo de spin-up por test (~10-20 s en primera vez).
///
/// El connection string se expone vía <see cref="ConnectionString"/> y se inyecta
/// en <see cref="SmartMenuWebApplicationFactory"/>.
/// </summary>
public sealed class SqlServerContainerFixture : IAsyncLifetime
{
    private readonly MsSqlContainer _container = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .WithPassword("Test_Password_123!")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.StopAsync();
        await _container.DisposeAsync();
    }
}
