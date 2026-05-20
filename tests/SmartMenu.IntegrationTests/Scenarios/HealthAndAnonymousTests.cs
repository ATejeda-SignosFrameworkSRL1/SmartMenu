using System.Net;
using FluentAssertions;
using SmartMenu.IntegrationTests.Fixtures;

namespace SmartMenu.IntegrationTests.Scenarios;

/// <summary>
/// S1.D3 Stage 3 — happy paths críticos contra SQL Server real.
/// (1) /health/live; (2) endpoints customer-facing anónimos (P0.1).
/// </summary>
[Collection("Integration")]
public class HealthAndAnonymousTests
{
    private readonly SmartMenuWebApplicationFactory _factory;

    public HealthAndAnonymousTests(SqlServerContainerFixture sql)
    {
        _factory = new SmartMenuWebApplicationFactory { ConnectionString = sql.ConnectionString };
    }

    [Fact]
    public async Task HealthLive_returns_200_without_auth()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health/live");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GET_api_dish_is_anonymous_for_customer_app()
    {
        // P0.1: customer-app necesita catálogo sin login (QR flow).
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/dish");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GET_api_menu_is_anonymous_for_customer_app()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/menu");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GET_api_order_active_without_auth_returns_401()
    {
        // /api/order/active SÍ acepta GET y exige [Authorize] — confirma que el filter aplica.
        // (No usamos / a secas porque algunos controllers no exponen GET en root y dan 405.)
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/order/active");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
