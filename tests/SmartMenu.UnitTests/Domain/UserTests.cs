using Xunit;
using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

public class UserTests
{
    [Fact]
    public void User_ShouldCreateWithDefaultActiveStatus()
    {
        // Arrange & Act
        var user = new User
        {
            Email = "test@example.com",
            FirstName = "John",
            LastName = "Doe",
            Role = UserRole.Customer,
            IsActive = true
        };

        // Assert
        user.IsActive.Should().BeTrue();
        user.Email.Should().Be("test@example.com");
        user.Role.Should().Be(UserRole.Customer);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Waiter)]
    [InlineData(UserRole.Chef)]
    [InlineData(UserRole.Customer)]
    public void User_ShouldAcceptAllValidRoles(UserRole role)
    {
        // Arrange & Act
        var user = new User
        {
            Email = "test@example.com",
            Role = role
        };

        // Assert
        user.Role.Should().Be(role);
    }

    [Fact]
    public void User_ShouldHavePasswordHash()
    {
        // Arrange
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("Test123!");
        
        // Act
        var user = new User
        {
            Email = "test@example.com",
            PasswordHash = passwordHash
        };

        // Assert
        user.PasswordHash.Should().NotBeNullOrEmpty();
        BCrypt.Net.BCrypt.Verify("Test123!", user.PasswordHash).Should().BeTrue();
    }
}
