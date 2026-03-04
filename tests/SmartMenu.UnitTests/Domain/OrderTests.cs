using Xunit;
using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

public class OrderTests
{
    [Fact]
    public void Order_ShouldCalculateTotalCorrectly()
    {
        // Arrange
        var order = new Order
        {
            Subtotal = 1000m,
            Tax = 180m,
            Tip = 100m,
            Discount = 50m
        };

        // Act
        order.Total = order.Subtotal + order.Tax + order.Tip - order.Discount;

        // Assert
        order.Total.Should().Be(1230m);
    }

    [Fact]
    public void Order_ShouldHaveCorrectInitialStatus()
    {
        // Arrange & Act
        var order = new Order
        {
            OrderNumber = "ORD-001",
            TableId = 1,
            SessionId = "session-1",
            Status = OrderStatus.Pending
        };

        // Assert
        order.Status.Should().Be(OrderStatus.Pending);
    }

    [Fact]
    public void Order_ShouldAddOrderItemsCorrectly()
    {
        // Arrange
        var order = new Order();
        var item1 = new OrderItem { DishId = 1, Quantity = 2, UnitPrice = 500m };
        var item2 = new OrderItem { DishId = 2, Quantity = 1, UnitPrice = 300m };

        // Act
        order.Items.Add(item1);
        order.Items.Add(item2);

        // Assert
        order.Items.Should().HaveCount(2);
        order.Items.Should().Contain(item1);
        order.Items.Should().Contain(item2);
    }
}
