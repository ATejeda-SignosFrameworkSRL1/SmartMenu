using FluentAssertions;
using SmartMenu.Domain.Entities;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — BaseEntity invariants (heredados por las 25 entities).
/// CreatedAt/UpdatedAt deben inicializarse a DateTime.UtcNow al construir;
/// Id default 0 (lo asigna SQL identity).
/// </summary>
public class BaseEntityTests
{
    private class Probe : BaseEntity { }

    [Fact]
    public void Defaults_Id_is_zero()
    {
        var e = new Probe();
        e.Id.Should().Be(0);
    }

    [Fact]
    public void Defaults_CreatedAt_is_now_UTC()
    {
        var before = DateTime.UtcNow;
        var e = new Probe();
        var after = DateTime.UtcNow;
        e.CreatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        e.CreatedAt.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void Defaults_UpdatedAt_is_now_UTC()
    {
        var before = DateTime.UtcNow;
        var e = new Probe();
        var after = DateTime.UtcNow;
        e.UpdatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        e.UpdatedAt.Kind.Should().Be(DateTimeKind.Utc);
    }
}
