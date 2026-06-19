using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.UnitTests.Application;

/// <summary>
/// Bug regression — bartender@smartmenu.com fue sembrado con Role=Waiter (en lugar
/// de Bartender), lo cual rompía el quick-login del KDS (rechaza "Tu rol (Mesero)
/// no tiene acceso a este módulo"). EnsureBartenderRoleAsync corrige idempotente
/// el rol en DBs existentes y elimina el duplicado legacy bar@smartmenu.com.
///
/// Tests usan EFCore InMemory para verificar el comportamiento del corrector.
/// </summary>
public class DbInitializerTests
{
    private static ApplicationDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static User Bartender(UserRole role) => new()
    {
        Id = 1, Email = "bartender@smartmenu.com",
        PasswordHash = "x", FirstName = "Carlos", LastName = "Martínez",
        Role = role, IsActive = true,
    };

    [Fact]
    public async Task Corrects_bartender_role_when_sembrado_como_Waiter()
    {
        await using var db = NewDb();
        db.Users.Add(Bartender(UserRole.Waiter));
        await db.SaveChangesAsync();

        await DbInitializer.EnsureBartenderRoleAsync(db);

        var reloaded = await db.Users.FirstAsync(u => u.Email == "bartender@smartmenu.com");
        reloaded.Role.Should().Be(UserRole.Bartender);
    }

    [Fact]
    public async Task Is_idempotent_when_bartender_role_already_correct()
    {
        await using var db = NewDb();
        db.Users.Add(Bartender(UserRole.Bartender));
        await db.SaveChangesAsync();

        var act = async () => await DbInitializer.EnsureBartenderRoleAsync(db);
        await act.Should().NotThrowAsync();

        var reloaded = await db.Users.FirstAsync(u => u.Email == "bartender@smartmenu.com");
        reloaded.Role.Should().Be(UserRole.Bartender);
    }

    [Fact]
    public async Task Removes_legacy_bar_user_duplicate()
    {
        await using var db = NewDb();
        db.Users.Add(Bartender(UserRole.Bartender));
        db.Users.Add(new User
        {
            Id = 2, Email = "bar@smartmenu.com", PasswordHash = "x",
            FirstName = "Bar", LastName = "Legacy",
            Role = UserRole.Bartender, IsActive = true,
        });
        await db.SaveChangesAsync();

        await DbInitializer.EnsureBartenderRoleAsync(db);

        (await db.Users.AnyAsync(u => u.Email == "bar@smartmenu.com")).Should().BeFalse();
        (await db.Users.AnyAsync(u => u.Email == "bartender@smartmenu.com")).Should().BeTrue();
    }

    [Fact]
    public async Task Does_not_throw_when_bartender_user_missing()
    {
        await using var db = NewDb();
        // No bartender ni bar — DB vacía
        var act = async () => await DbInitializer.EnsureBartenderRoleAsync(db);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Does_not_create_bartender_if_missing()
    {
        // Diseño explícito: si bartender@ NO existe, el método NO lo crea.
        // SeedAsync es responsable de crearlo. Este método solo corrige roles + limpia duplicados.
        await using var db = NewDb();

        await DbInitializer.EnsureBartenderRoleAsync(db);

        (await db.Users.AnyAsync(u => u.Email == "bartender@smartmenu.com")).Should().BeFalse();
    }
}
