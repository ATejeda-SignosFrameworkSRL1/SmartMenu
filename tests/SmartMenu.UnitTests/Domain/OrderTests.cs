using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — Order entity invariants: defaults, state, kitchen/bar flags,
/// fiscal client fields, navigation collections init, RowVersion presence.
/// </summary>
public class OrderTests
{
    [Fact]
    public void Defaults_status_is_Pending()
    {
        new Order().Status.Should().Be(OrderStatus.Pending);
    }

    [Fact]
    public void Defaults_IsPickup_false()
    {
        new Order().IsPickup.Should().BeFalse();
    }

    [Fact]
    public void Defaults_all_kitchen_bar_flags_false()
    {
        var o = new Order();
        o.KitchenPreparing.Should().BeFalse();
        o.BarPreparing.Should().BeFalse();
        o.KitchenReady.Should().BeFalse();
        o.BarReady.Should().BeFalse();
        o.KitchenServed.Should().BeFalse();
        o.BarServed.Should().BeFalse();
        o.CustomerFinishedEating.Should().BeFalse();
    }

    [Fact]
    public void Defaults_client_fiscal_fields_off()
    {
        var o = new Order();
        o.ClientRequiresFiscalReceipt.Should().BeFalse();
        o.ClientRNC.Should().BeNull();
        o.ClientBusinessName.Should().BeNull();
        o.ClientTipPercentage.Should().Be(0);
        o.ClientTipAmount.Should().Be(0);
        o.ClientRequestedPaymentMethod.Should().BeNull();
    }

    [Fact]
    public void Defaults_collections_initialized_not_null()
    {
        var o = new Order();
        o.Items.Should().NotBeNull().And.BeEmpty();
        o.Payments.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void Defaults_OrderNumber_and_SessionId_are_empty_string()
    {
        var o = new Order();
        o.OrderNumber.Should().Be(string.Empty);
        o.SessionId.Should().Be(string.Empty);
    }

    [Fact]
    public void Items_collection_supports_add()
    {
        var o = new Order();
        o.Items.Add(new OrderItem { DishId = 1, Quantity = 2, UnitPrice = 500m });
        o.Items.Add(new OrderItem { DishId = 2, Quantity = 1, UnitPrice = 300m });
        o.Items.Should().HaveCount(2);
    }

    [Theory]
    [InlineData(OrderStatus.Pending)]
    [InlineData(OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Preparing)]
    [InlineData(OrderStatus.Ready)]
    [InlineData(OrderStatus.Served)]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Cancelled)]
    public void Status_accepts_all_defined_enum_values(OrderStatus s)
    {
        var o = new Order { Status = s };
        o.Status.Should().Be(s);
    }

    [Fact]
    public void RowVersion_property_exists_and_starts_null()
    {
        new Order().RowVersion.Should().BeNull();
    }

    [Fact]
    public void TableId_is_nullable_for_pickup_orders()
    {
        var pickup = new Order { IsPickup = true, TableId = null };
        pickup.TableId.Should().BeNull();
        pickup.IsPickup.Should().BeTrue();
    }
}
