using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — Bulk tests para las entities restantes:
///   Restaurant, Menu, Category, OrderItem, DishImage, DishTag, DishDishTag,
///   VirtualTable, VirtualTableTable, WaiterShift, LoginAttempt,
///   TableClaimRequest, TableTransferRequest, ReservationPreOrder, PreOrderItem.
///
/// Cada una recibe coverage básico: defaults + collections init + enums donde aplica.
/// </summary>
public class MiscEntitiesTests
{
    [Fact]
    public void Restaurant_defaults()
    {
        var r = new Restaurant();
        r.Name.Should().Be(string.Empty);
        r.Address.Should().Be(string.Empty);
        r.Phone.Should().Be(string.Empty);
        r.Email.Should().Be(string.Empty);
        r.RNC.Should().BeNull();
        r.Logo.Should().BeNull();
        r.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Menu_defaults()
    {
        var m = new Menu();
        m.Name.Should().Be(string.Empty);
        m.IsActive.Should().BeTrue();
        m.Categories.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void Category_defaults()
    {
        var c = new Category();
        c.Name.Should().Be(string.Empty);
        c.IsActive.Should().BeTrue();
        c.SortOrder.Should().Be(0);
        c.Dishes.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void OrderItem_defaults()
    {
        var i = new OrderItem();
        i.Quantity.Should().Be(0);
        i.UnitPrice.Should().Be(0m);
        i.Subtotal.Should().Be(0m);
        i.Notes.Should().BeNull();
        i.Destination.Should().BeNull();
    }

    [Fact]
    public void DishImage_defaults()
    {
        var img = new DishImage();
        img.ImageUrl.Should().Be(string.Empty);
        img.DisplayOrder.Should().Be(0);
        img.IsMain.Should().BeFalse();
    }

    [Fact]
    public void DishTag_defaults()
    {
        var t = new DishTag();
        t.Code.Should().Be(string.Empty);
        t.Label.Should().Be(string.Empty);
        t.Icon.Should().Be(string.Empty);
        t.IsActive.Should().BeTrue();
    }

    [Fact]
    public void DishDishTag_is_join_entity()
    {
        var dd = new DishDishTag { DishId = 1, DishTagId = 2 };
        dd.DishId.Should().Be(1);
        dd.DishTagId.Should().Be(2);
    }

    [Fact]
    public void VirtualTable_defaults()
    {
        var v = new VirtualTable();
        v.Name.Should().Be(string.Empty);
        v.IsActive.Should().BeTrue();
        v.DeactivatedAt.Should().BeNull();
        v.Tables.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void VirtualTableTable_is_join_entity()
    {
        var vt = new VirtualTableTable { VirtualTableId = 1, TableId = 2 };
        vt.VirtualTableId.Should().Be(1);
        vt.TableId.Should().Be(2);
    }

    [Fact]
    public void WaiterShift_defaults()
    {
        var s = new WaiterShift();
        s.IsActive.Should().BeTrue();
        s.EndTime.Should().BeNull();
        s.Notes.Should().BeNull();
    }

    [Fact]
    public void LoginAttempt_defaults()
    {
        var before = DateTime.UtcNow;
        var l = new LoginAttempt();
        var after = DateTime.UtcNow;
        l.Email.Should().Be(string.Empty);
        l.IpAddress.Should().BeNull();
        l.Success.Should().BeFalse();
        l.AttemptedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void LoginAttempt_can_mark_success()
    {
        var l = new LoginAttempt { Email = "u@x.com", Success = true };
        l.Success.Should().BeTrue();
    }

    [Fact]
    public void TableClaimRequest_default_status_Pending()
    {
        new TableClaimRequest().Status.Should().Be(ClaimRequestStatus.Pending);
    }

    [Theory]
    [InlineData(ClaimRequestStatus.Pending)]
    [InlineData(ClaimRequestStatus.Approved)]
    [InlineData(ClaimRequestStatus.Rejected)]
    public void TableClaimRequest_status_accepts_all(ClaimRequestStatus s)
    {
        new TableClaimRequest { Status = s }.Status.Should().Be(s);
    }

    [Fact]
    public void TableTransferRequest_default_status_Pending()
    {
        new TableTransferRequest().Status.Should().Be(TransferStatus.Pending);
    }

    [Fact]
    public void TableTransferRequest_TableIdsJson_default_empty_array()
    {
        new TableTransferRequest().TableIdsJson.Should().Be("[]");
    }

    [Fact]
    public void ReservationPreOrder_defaults_collection_init()
    {
        var p = new ReservationPreOrder();
        p.Items.Should().NotBeNull().And.BeEmpty();
        p.Notes.Should().BeNull();
    }

    [Fact]
    public void PreOrderItem_defaults()
    {
        var i = new PreOrderItem();
        i.Quantity.Should().Be(0);
        i.Notes.Should().BeNull();
    }
}
