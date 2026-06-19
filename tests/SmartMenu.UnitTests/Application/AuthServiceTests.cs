using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Repositories;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;
using SmartMenu.Infrastructure.Services;

namespace SmartMenu.UnitTests.Application;

/// <summary>
/// S1.D2 — AuthService (S4.2 password policy, S4.3 lockout, refresh-token rotation + replay defense).
/// Usa EFCore InMemory para ApplicationDbContext (LoginAttempts, RefreshTokens) y Moq para IUserRepository.
/// </summary>
public class AuthServiceTests
{
    private const string ValidPassword = "ValidPass12!"; // 12 chars: upper, lower, digit, special.
    private const string ValidPassword2 = "AnotherStrong9$";

    private static ApplicationDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static IConfiguration NewConfig() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:Secret"] = "test-secret-key-with-32+chars-for-hmacsha256-signing-OK",
            ["JwtSettings:Issuer"] = "SmartMenuTest",
            ["JwtSettings:Audience"] = "SmartMenuTestClients",
            ["JwtSettings:ExpirationMinutes"] = "60",
        }).Build();

    private static (AuthService svc, Mock<IUserRepository> repo, ApplicationDbContext db) Build()
    {
        var db = NewDb();
        var repo = new Mock<IUserRepository>();
        var svc = new AuthService(repo.Object, NewConfig(), db);
        return (svc, repo, db);
    }

    // ─── Password policy (S4.2) ────────────────────────────────────────────
    [Theory]
    [InlineData("short1!")]              // <12
    [InlineData("alllowercase1!")]        // sin upper
    [InlineData("ALLUPPERCASE1!")]        // sin lower
    [InlineData("NoDigitsHere!")]         // sin digit
    [InlineData("NoSpecial1234")]         // sin special
    public async Task Register_rejects_weak_password(string weakPwd)
    {
        var (svc, _, _) = Build();
        var act = () => svc.RegisterAsync(new RegisterDto { Email = "u@x.com", Password = weakPwd });
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*contraseña*"); // mensaje en español
    }

    [Fact]
    public async Task Register_rejects_duplicate_email()
    {
        var (svc, repo, _) = Build();
        repo.Setup(r => r.EmailExistsAsync("u@x.com", default)).ReturnsAsync(true);

        var act = () => svc.RegisterAsync(new RegisterDto { Email = "u@x.com", Password = ValidPassword });

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*already registered*");
    }

    [Fact]
    public async Task Register_creates_user_with_hashed_password_and_returns_tokens()
    {
        var (svc, repo, _) = Build();
        User? captured = null;
        repo.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), default)).ReturnsAsync(false);
        repo.Setup(r => r.AddAsync(It.IsAny<User>(), default))
            .Callback<User, CancellationToken>((u, _) => { captured = u; u.Id = 1; })
            .ReturnsAsync((User u, CancellationToken _) => u);

        var result = await svc.RegisterAsync(new RegisterDto
        {
            Email = "new@user.com",
            Password = ValidPassword,
            FirstName = "Ana",
            LastName = "Lopez",
        });

        captured.Should().NotBeNull();
        captured!.Email.Should().Be("new@user.com");
        captured.PasswordHash.Should().NotBe(ValidPassword); // hasheado
        BCrypt.Net.BCrypt.Verify(ValidPassword, captured.PasswordHash).Should().BeTrue();
        captured.Role.Should().Be(UserRole.Customer);
        result.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
        result.User.Email.Should().Be("new@user.com");
    }

    // ─── Login (S4.3 lockout) ──────────────────────────────────────────────
    private static User SeedUser(string email = "user@x.com", string password = ValidPassword, bool active = true)
        => new()
        {
            Id = 42,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            FirstName = "Test",
            LastName = "User",
            Role = UserRole.Customer,
            IsActive = active,
        };

    [Fact]
    public async Task Login_with_unknown_email_throws_unauthorized_and_records_attempt()
    {
        var (svc, repo, db) = Build();
        repo.Setup(r => r.GetByEmailAsync("nope@x.com", default)).ReturnsAsync((User?)null);

        var act = () => svc.LoginAsync(new LoginDto { Email = "nope@x.com", Password = "whatever123!" });
        await act.Should().ThrowAsync<UnauthorizedAccessException>();

        // LoginAttempt persistido con Success=false (auditoría)
        var attempts = await db.LoginAttempts.ToListAsync();
        attempts.Should().HaveCount(1);
        attempts[0].Success.Should().BeFalse();
        attempts[0].Email.Should().Be("nope@x.com");
    }

    [Fact]
    public async Task Login_with_wrong_password_throws_and_records_failure()
    {
        var (svc, repo, db) = Build();
        repo.Setup(r => r.GetByEmailAsync("user@x.com", default)).ReturnsAsync(SeedUser());

        var act = () => svc.LoginAsync(new LoginDto { Email = "user@x.com", Password = "WrongPass1!" });
        await act.Should().ThrowAsync<UnauthorizedAccessException>();

        (await db.LoginAttempts.CountAsync(a => !a.Success)).Should().Be(1);
    }

    [Fact]
    public async Task Login_with_inactive_user_throws_and_records_failure()
    {
        var (svc, repo, _) = Build();
        repo.Setup(r => r.GetByEmailAsync("u@x.com", default)).ReturnsAsync(SeedUser(active: false));

        var act = () => svc.LoginAsync(new LoginDto { Email = "u@x.com", Password = ValidPassword });
        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*inactive*");
    }

    [Fact]
    public async Task Login_lockout_after_5_failed_attempts_in_window()
    {
        var (svc, repo, db) = Build();
        repo.Setup(r => r.GetByEmailAsync(It.IsAny<string>(), default)).ReturnsAsync((User?)null);

        // 5 fallos en ventana
        for (int i = 0; i < 5; i++)
        {
            db.LoginAttempts.Add(new LoginAttempt
            {
                Email = "lock@x.com",
                Success = false,
                AttemptedAt = DateTime.UtcNow.AddMinutes(-1),
            });
        }
        await db.SaveChangesAsync();

        var act = () => svc.LoginAsync(new LoginDto { Email = "lock@x.com", Password = "WhateverPwd1!" });
        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*Demasiados intentos*");
    }

    [Fact]
    public async Task Login_success_returns_tokens_and_persists_success_row()
    {
        var (svc, repo, db) = Build();
        repo.Setup(r => r.GetByEmailAsync("u@x.com", default)).ReturnsAsync(SeedUser());

        var result = await svc.LoginAsync(new LoginDto { Email = "u@x.com", Password = ValidPassword });

        result.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
        (await db.LoginAttempts.AnyAsync(a => a.Success)).Should().BeTrue();
        (await db.RefreshTokens.AnyAsync()).Should().BeTrue();
    }

    // ─── Refresh-token rotation + replay defense ───────────────────────────
    [Fact]
    public async Task Refresh_with_blank_token_throws()
    {
        var (svc, _, _) = Build();
        var act = () => svc.RefreshAsync("");
        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*required*");
    }

    [Fact]
    public async Task Refresh_with_unknown_token_throws()
    {
        var (svc, _, _) = Build();
        var act = () => svc.RefreshAsync("not-a-real-token");
        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*Invalid*");
    }

    [Fact]
    public async Task Refresh_replay_detection_revokes_entire_chain()
    {
        // Si llega un refresh token YA revocado, AuthService revoca toda la cadena del usuario.
        var (svc, repo, db) = Build();
        var user = SeedUser();
        db.Users.Add(user);
        // Tokens activos + uno ya revocado (replay candidate)
        var revokedHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes("replay-token")));
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id, TokenHash = revokedHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = DateTime.UtcNow.AddMinutes(-30),
        });
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id, TokenHash = "ACTIVE-OTHER",
            ExpiresAt = DateTime.UtcNow.AddDays(7), RevokedAt = null,
        });
        await db.SaveChangesAsync();

        var act = () => svc.RefreshAsync("replay-token");
        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*reuse detected*");

        var remainingActive = await db.RefreshTokens.CountAsync(t => t.RevokedAt == null);
        remainingActive.Should().Be(0); // toda la cadena revocada
    }

    [Fact]
    public async Task Refresh_expired_token_throws()
    {
        var (svc, _, db) = Build();
        var user = SeedUser();
        db.Users.Add(user);
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes("expired-token")));
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id, TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1), // expirado
            RevokedAt = null,
        });
        await db.SaveChangesAsync();

        var act = () => svc.RefreshAsync("expired-token");
        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*expired*");
    }

    [Fact]
    public async Task Refresh_valid_token_rotates_and_returns_new_pair()
    {
        var (svc, _, db) = Build();
        var user = SeedUser();
        db.Users.Add(user);
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes("valid-token")));
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id, TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = null,
        });
        await db.SaveChangesAsync();

        var result = await svc.RefreshAsync("valid-token");

        result.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBe("valid-token"); // rotado

        // El viejo quedó revocado y encadenado al nuevo.
        var oldToken = await db.RefreshTokens.FirstAsync(t => t.TokenHash == hash);
        oldToken.RevokedAt.Should().NotBeNull();
        oldToken.ReplacedByTokenHash.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetUserByEmail_returns_null_when_not_found()
    {
        var (svc, repo, _) = Build();
        repo.Setup(r => r.GetByEmailAsync("ghost@x.com", default)).ReturnsAsync((User?)null);
        (await svc.GetUserByEmailAsync("ghost@x.com")).Should().BeNull();
    }

    [Fact]
    public async Task GetUserByEmail_maps_to_dto_when_found()
    {
        var (svc, repo, _) = Build();
        repo.Setup(r => r.GetByEmailAsync("u@x.com", default)).ReturnsAsync(SeedUser());
        var dto = await svc.GetUserByEmailAsync("u@x.com");
        dto.Should().NotBeNull();
        dto!.Email.Should().Be("user@x.com");
        dto.Role.Should().Be("Customer");
    }
}
