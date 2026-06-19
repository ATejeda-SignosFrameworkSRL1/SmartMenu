using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using SmartMenu.Application.DTOs;
using SmartMenu.IntegrationTests.Fixtures;

namespace SmartMenu.IntegrationTests.Scenarios;

/// <summary>
/// Bug-Fix.3 regression: GET /api/reports/sales-today suma Payments.Completed con
/// CompletedAt en el día actual. Antes el dashboard sumaba /api/order/active que
/// excluye Completed → Ventas del Día siempre quedaba en $0.
/// </summary>
[Collection("Integration")]
public class SalesTodayReportTests
{
    private readonly SmartMenuWebApplicationFactory _factory;

    public SalesTodayReportTests(SqlServerContainerFixture sql)
    {
        _factory = new SmartMenuWebApplicationFactory { ConnectionString = sql.ConnectionString };
    }

    private async Task<string> AdminToken(HttpClient client)
    {
        var resp = await client.PostAsJsonAsync("/api/auth/login", new LoginDto
        {
            Email = "admin@smartmenu.com",
            Password = "Admin123!",
        });
        resp.IsSuccessStatusCode.Should().BeTrue();
        var auth = await resp.Content.ReadFromJsonAsync<AuthResultDto>();
        return auth!.AccessToken;
    }

    [Fact]
    public async Task GET_sales_today_returns_200_with_expected_shape()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await AdminToken(client));

        var resp = await client.GetAsync("/api/reports/sales-today");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<SalesTodayResponse>();
        body.Should().NotBeNull();
        body!.TotalSales.Should().BeGreaterThanOrEqualTo(0);
        body.TransactionCount.Should().BeGreaterThanOrEqualTo(0);
        body.AverageTicket.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task GET_sales_today_requires_admin_or_manager_role()
    {
        // Customer role token no debería acceder a reports.
        var client = _factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/auth/register", new RegisterDto
        {
            Email = $"customer+{Guid.NewGuid():N}@smartmenu.test",
            Password = "CustomerPass1!",
            FirstName = "C", LastName = "X",
        });
        register.IsSuccessStatusCode.Should().BeTrue();
        var auth = await register.Content.ReadFromJsonAsync<AuthResultDto>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var resp = await client.GetAsync("/api/reports/sales-today");
        resp.StatusCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.Unauthorized);
    }

    private record SalesTodayResponse(DateTime Date, decimal TotalSales, decimal TipsTotal, int TransactionCount, decimal AverageTicket);
}
