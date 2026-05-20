using FluentAssertions;
using SmartMenu.Domain.Entities;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — TableReservation invariants: Source default "Internal",
/// AdvanceBlockMinutes=60, IsConfirmed/IsCancelled false default,
/// CustomerName/CustomerPhone empty (no null).
/// </summary>
public class TableReservationTests
{
    [Fact]
    public void Defaults_Source_is_Internal()
    {
        new TableReservation().Source.Should().Be("Internal");
    }

    [Fact]
    public void Defaults_AdvanceBlockMinutes_is_60()
    {
        new TableReservation().AdvanceBlockMinutes.Should().Be(60);
    }

    [Fact]
    public void Defaults_flags_off()
    {
        var r = new TableReservation();
        r.IsConfirmed.Should().BeFalse();
        r.IsCancelled.Should().BeFalse();
    }

    [Fact]
    public void Defaults_customer_fields_empty_not_null()
    {
        var r = new TableReservation();
        r.CustomerName.Should().Be(string.Empty);
        r.CustomerPhone.Should().Be(string.Empty);
        r.CustomerEmail.Should().BeNull(); // email es nullable
    }

    [Fact]
    public void Defaults_confirmation_link_fields_null()
    {
        var r = new TableReservation();
        r.ConfirmationLink.Should().BeNull();
        r.ConfirmationLinkSentAt.Should().BeNull();
        r.ReservedUntil.Should().BeNull();
    }

    [Theory]
    [InlineData("Internal")]
    [InlineData("Portal")]
    public void Source_accepts_known_origins(string source)
    {
        new TableReservation { Source = source }.Source.Should().Be(source);
    }
}
