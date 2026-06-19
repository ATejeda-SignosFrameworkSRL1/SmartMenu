using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SmartMenu.IntegrationTests.Fixtures;

namespace SmartMenu.IntegrationTests.Scenarios;

/// <summary>
/// Bug-Fix.1 regression: POST /api/tablereservation/public + GET .../public/available-tables
/// deben aceptar requests anónimas (sin Authorization header).
///
/// Antes: el controller tenía [Authorize] a nivel de clase y los métodos públicos
/// no override con [AllowAnonymous] → 401 a clientes anónimos del portal.
/// </summary>
[Collection("Integration")]
public class PublicReservationTests
{
    private readonly SmartMenuWebApplicationFactory _factory;

    public PublicReservationTests(SqlServerContainerFixture sql)
    {
        _factory = new SmartMenuWebApplicationFactory { ConnectionString = sql.ConnectionString };
    }

    [Fact]
    public async Task GET_public_available_tables_anonymous_returns_200()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync(
            $"/api/tablereservation/public/available-tables?dateTime=2026-12-31T20:00:00&guests=2");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task POST_public_reservation_anonymous_returns_200_with_id()
    {
        // Necesitamos un TableId real. Pedimos el primero de la DB sembrada.
        var client = _factory.CreateClient();
        var tablesResp = await client.GetAsync("/api/tablereservation/public/available-tables?dateTime=2026-12-31T20:00:00&guests=2");
        tablesResp.IsSuccessStatusCode.Should().BeTrue();
        var tables = await tablesResp.Content.ReadFromJsonAsync<List<TableAvailable>>();
        tables.Should().NotBeNull().And.NotBeEmpty();
        var tableId = tables![0].Id;

        var payload = new
        {
            tableId,
            reservationDateTime = "2026-12-31T20:00:00",
            numberOfGuests = 2,
            customerName = "Test Anonymous E2E",
            customerPhone = "8095550100"
        };
        var resp = await client.PostAsJsonAsync("/api/tablereservation/public", payload);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<CreateReservationResponse>();
        body.Should().NotBeNull();
        body!.Id.Should().BeGreaterThan(0);
    }

    private record TableAvailable(int Id, int TableNumber, int Capacity, string ZoneName);
    private record CreateReservationResponse(int Id, string Message);
}
