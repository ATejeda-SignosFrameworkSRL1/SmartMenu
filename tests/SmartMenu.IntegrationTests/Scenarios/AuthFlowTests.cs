using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using SmartMenu.Application.DTOs;
using SmartMenu.IntegrationTests.Fixtures;

namespace SmartMenu.IntegrationTests.Scenarios;

/// <summary>
/// S1.D3 — Flujo de auth completo end-to-end: register → login → /me con bearer.
/// Verifica integración real entre AuthService (BCrypt + JWT) y el pipeline de
/// JwtBearer middleware en Program.cs.
/// </summary>
[Collection("Integration")]
public class AuthFlowTests
{
    private readonly SmartMenuWebApplicationFactory _factory;

    public AuthFlowTests(SqlServerContainerFixture sql)
    {
        _factory = new SmartMenuWebApplicationFactory { ConnectionString = sql.ConnectionString };
    }

    private static string UniqueEmail() => $"test+{Guid.NewGuid():N}@smartmenu.test";

    [Fact]
    public async Task Register_Login_Me_happy_path()
    {
        var client = _factory.CreateClient();
        var email = UniqueEmail();
        var password = "IntegrationPass1!"; // pasa policy S4.2

        // 1. Register
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new RegisterDto
        {
            Email = email, Password = password,
            FirstName = "Int", LastName = "Test",
        });
        registerResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await registerResp.Content.ReadFromJsonAsync<AuthResultDto>();
        auth.Should().NotBeNull();
        auth!.AccessToken.Should().NotBeNullOrEmpty();
        auth.User.Email.Should().Be(email);
        // Role default es Customer; el DTO serializa el enum a string.
        auth.User.Role.Should().NotBeNullOrEmpty();

        // 2. Login con esas mismas credenciales
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new LoginDto
        {
            Email = email, Password = password,
        });
        loginResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginResult = await loginResp.Content.ReadFromJsonAsync<AuthResultDto>();
        loginResult.Should().NotBeNull();
        loginResult!.AccessToken.Should().NotBeNullOrEmpty();

        // 3. /me con bearer token → 200 con datos del usuario
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginResult.AccessToken);
        var meResp = await client.GetAsync("/api/auth/me");
        meResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var me = await meResp.Content.ReadFromJsonAsync<UserDto>();
        me!.Email.Should().Be(email);
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_401()
    {
        var client = _factory.CreateClient();
        var email = UniqueEmail();

        // Registrar primero
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new RegisterDto
        {
            Email = email, Password = "RealPassword1!",
            FirstName = "Int", LastName = "Test",
        });
        registerResp.IsSuccessStatusCode.Should().BeTrue();

        // Intentar login con password incorrecta
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new LoginDto
        {
            Email = email, Password = "WrongPassword1!",
        });
        loginResp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Register_with_weak_password_returns_400()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/register", new RegisterDto
        {
            Email = UniqueEmail(),
            Password = "short", // <12 chars, sin upper/digit/special
            FirstName = "A", LastName = "B",
        });
        // Middleware mapea InvalidOperationException → 400.
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Me_endpoint_without_token_returns_401()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/auth/me");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
