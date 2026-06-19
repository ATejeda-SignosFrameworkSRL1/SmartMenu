using FluentAssertions;
using SmartMenu.Domain.Entities;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — TableSession invariants: IsActive default true (sesión abre activa),
/// StartTime UtcNow, EndTime null hasta cerrar, Orders collection init.
/// </summary>
public class TableSessionTests
{
    [Fact]
    public void Defaults_IsActive_true()
    {
        new TableSession().IsActive.Should().BeTrue();
    }

    [Fact]
    public void Defaults_StartTime_is_now_UTC()
    {
        var before = DateTime.UtcNow;
        var s = new TableSession();
        var after = DateTime.UtcNow;
        s.StartTime.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void Defaults_EndTime_null_until_closed()
    {
        new TableSession().EndTime.Should().BeNull();
    }

    [Fact]
    public void Defaults_Orders_collection_initialized()
    {
        new TableSession().Orders.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void Defaults_optional_assignments_nullable()
    {
        var s = new TableSession();
        s.AssignedWaiterId.Should().BeNull();
        s.AssignedByHostId.Should().BeNull();
        s.SpecialNotes.Should().BeNull();
    }

    [Fact]
    public void Closing_session_sets_EndTime_and_IsActive_false()
    {
        var s = new TableSession { IsActive = true };
        s.IsActive = false;
        s.EndTime = DateTime.UtcNow;
        s.IsActive.Should().BeFalse();
        s.EndTime.Should().NotBeNull();
    }
}
