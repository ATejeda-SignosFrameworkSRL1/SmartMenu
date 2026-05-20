using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — Table + Zone invariants (mesa y zona del restaurante).
/// </summary>
public class TableAndZoneTests
{
    // ─── Table ─────────────────────────────────────────────────────────────
    [Fact]
    public void Table_default_status_Available()
    {
        new Table().Status.Should().Be(TableStatus.Available);
    }

    [Fact]
    public void Table_default_QRCode_empty()
    {
        new Table().QRCode.Should().Be(string.Empty);
    }

    [Theory]
    [InlineData(TableStatus.Available)]
    [InlineData(TableStatus.Occupied)]
    [InlineData(TableStatus.Reserved)]
    [InlineData(TableStatus.Cleaning)]
    [InlineData(TableStatus.Billing)]
    public void Table_status_accepts_all_values(TableStatus s)
    {
        new Table { Status = s }.Status.Should().Be(s);
    }

    // ─── Zone ──────────────────────────────────────────────────────────────
    [Fact]
    public void Zone_default_Type_Dining()
    {
        new Zone().Type.Should().Be("Dining");
    }

    [Fact]
    public void Zone_default_IsActive_true()
    {
        new Zone().IsActive.Should().BeTrue();
    }

    [Fact]
    public void Zone_default_Tables_collection_initialized()
    {
        new Zone().Tables.Should().NotBeNull().And.BeEmpty();
    }

    [Theory]
    [InlineData("Dining")]
    [InlineData("Bar")]
    [InlineData("Terrace")]
    [InlineData("VIP")]
    public void Zone_Type_accepts_known_values(string type)
    {
        new Zone { Type = type }.Type.Should().Be(type);
    }
}
