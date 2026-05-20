using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — User entity invariants: BCrypt hashing, todos los roles, defaults.
/// </summary>
public class UserTests
{
    [Fact]
    public void Defaults_FirstName_LastName_empty()
    {
        var u = new User();
        u.FirstName.Should().Be(string.Empty);
        u.LastName.Should().Be(string.Empty);
        u.Email.Should().Be(string.Empty);
        u.PasswordHash.Should().Be(string.Empty);
    }

    [Fact]
    public void Defaults_AssignedZoneId_nullable()
    {
        new User().AssignedZoneId.Should().BeNull();
    }

    [Fact]
    public void PasswordHash_BCrypt_verify_round_trip()
    {
        const string plain = "P@ssw0rd-Strong-2026";
        var hash = BCrypt.Net.BCrypt.HashPassword(plain);
        var u = new User { Email = "u@x.com", PasswordHash = hash };
        BCrypt.Net.BCrypt.Verify(plain, u.PasswordHash).Should().BeTrue();
        BCrypt.Net.BCrypt.Verify("wrong-password", u.PasswordHash).Should().BeFalse();
    }

    [Theory]
    [InlineData(UserRole.Customer)]
    [InlineData(UserRole.KitchenStaff)]
    [InlineData(UserRole.Chef)]
    [InlineData(UserRole.Waiter)]
    [InlineData(UserRole.Host)]
    [InlineData(UserRole.Cashier)]
    [InlineData(UserRole.Manager)]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Bartender)]
    public void Role_accepts_every_defined_enum_value(UserRole role)
    {
        new User { Role = role }.Role.Should().Be(role);
    }
}
