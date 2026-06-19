using FluentAssertions;
using SmartMenu.Domain.Entities;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — AuditLog (DGII compliance, DB separada DbNewMenuAudit).
/// No hereda BaseEntity; tiene Id long (puede ser tabla muy grande).
/// Timestamp se setea automáticamente.
/// </summary>
public class AuditLogTests
{
    [Fact]
    public void Defaults_Id_is_zero_long()
    {
        new AuditLog().Id.Should().Be(0L);
    }

    [Fact]
    public void Defaults_Timestamp_is_now_UTC()
    {
        var before = DateTime.UtcNow;
        var a = new AuditLog();
        var after = DateTime.UtcNow;
        a.Timestamp.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void Defaults_string_fields_empty_not_null()
    {
        var a = new AuditLog();
        a.EntityName.Should().Be(string.Empty);
        a.EntityId.Should().Be(string.Empty);
        a.Action.Should().Be(string.Empty);
    }

    [Fact]
    public void Defaults_optional_fields_nullable()
    {
        var a = new AuditLog();
        a.ChangesJson.Should().BeNull();
        a.UserId.Should().BeNull();
        a.UserEmail.Should().BeNull();
        a.Endpoint.Should().BeNull();
        a.IpAddress.Should().BeNull();
    }

    [Theory]
    [InlineData("Added")]
    [InlineData("Modified")]
    [InlineData("Deleted")]
    public void Action_accepts_EFCore_EntityState_strings(string action)
    {
        new AuditLog { Action = action }.Action.Should().Be(action);
    }

    [Fact]
    public void Full_audit_row_populated_correctly()
    {
        var a = new AuditLog
        {
            EntityName = "Dish",
            EntityId = "42",
            Action = "Modified",
            ChangesJson = """{"Price":{"old":"100","new":"120"}}""",
            UserId = 1,
            UserEmail = "admin@smartmenu.com",
            Endpoint = "/api/dish/42",
            IpAddress = "192.168.1.10",
        };
        a.EntityName.Should().Be("Dish");
        a.ChangesJson.Should().Contain("Price");
        a.Endpoint.Should().StartWith("/api/");
    }
}
