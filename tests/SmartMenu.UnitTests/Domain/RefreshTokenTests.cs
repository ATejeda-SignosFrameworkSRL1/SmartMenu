using FluentAssertions;
using SmartMenu.Domain.Entities;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — RefreshToken.IsActive es la única computed property de las 25
/// entities. Cubrimos los 3 caminos: expirado, revocado, activo.
/// </summary>
public class RefreshTokenTests
{
    [Fact]
    public void IsActive_true_when_not_revoked_and_not_expired()
    {
        var t = new RefreshToken
        {
            TokenHash = "abc",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = null,
        };
        t.IsActive.Should().BeTrue();
    }

    [Fact]
    public void IsActive_false_when_expired()
    {
        var t = new RefreshToken
        {
            TokenHash = "abc",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
            RevokedAt = null,
        };
        t.IsActive.Should().BeFalse();
    }

    [Fact]
    public void IsActive_false_when_revoked_even_if_not_expired()
    {
        var t = new RefreshToken
        {
            TokenHash = "abc",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = DateTime.UtcNow,
        };
        t.IsActive.Should().BeFalse();
    }

    [Fact]
    public void IsActive_false_when_both_revoked_and_expired()
    {
        var t = new RefreshToken
        {
            TokenHash = "abc",
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            RevokedAt = DateTime.UtcNow.AddDays(-1),
        };
        t.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Replacement_chain_tracks_via_ReplacedByTokenHash()
    {
        // Rotación: cada token usado se marca revoked y apunta al sucesor por hash.
        var old = new RefreshToken
        {
            TokenHash = "OLD-HASH",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = DateTime.UtcNow,
            ReplacedByTokenHash = "NEW-HASH",
        };
        old.IsActive.Should().BeFalse();
        old.ReplacedByTokenHash.Should().Be("NEW-HASH");
    }

    [Fact]
    public void Defaults_audit_fields_nullable()
    {
        var t = new RefreshToken();
        t.RevokedAt.Should().BeNull();
        t.ReplacedByTokenHash.Should().BeNull();
        t.CreatedByIp.Should().BeNull();
    }
}
