using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — Dish invariants: soft-delete por DGII, availability default true,
/// dietary flags default false, navigation collections init.
/// </summary>
public class DishTests
{
    [Fact]
    public void Defaults_IsAvailable_true()
    {
        new Dish().IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Defaults_dietary_flags_all_false()
    {
        var d = new Dish();
        d.IsVegetarian.Should().BeFalse();
        d.IsVegan.Should().BeFalse();
        d.IsGlutenFree.Should().BeFalse();
    }

    [Fact]
    public void Defaults_soft_delete_off()
    {
        var d = new Dish();
        d.IsDeleted.Should().BeFalse();
        d.DeletedAt.Should().BeNull();
    }

    [Fact]
    public void Defaults_DefaultCourse_is_PlatoFuerte()
    {
        new Dish().DefaultCourse.Should().Be(CourseTiming.PlatoFuerte);
    }

    [Fact]
    public void Defaults_KitchenZoneId_nullable_for_main_kitchen()
    {
        new Dish().KitchenZoneId.Should().BeNull();
    }

    [Fact]
    public void Defaults_strings_empty_not_null()
    {
        var d = new Dish();
        d.Name.Should().Be(string.Empty);
        d.Description.Should().Be(string.Empty);
    }

    [Fact]
    public void Defaults_collections_initialized()
    {
        var d = new Dish();
        d.OrderItems.Should().NotBeNull().And.BeEmpty();
        d.DishTags.Should().NotBeNull().And.BeEmpty();
        d.Images.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void Soft_delete_pattern_sets_DeletedAt()
    {
        // Patrón esperado: cuando el caller marca IsDeleted=true también setea DeletedAt.
        var d = new Dish { Name = "Test" };
        d.IsDeleted = true;
        d.DeletedAt = DateTime.UtcNow;
        d.IsDeleted.Should().BeTrue();
        d.DeletedAt.Should().NotBeNull();
    }

    [Theory]
    [InlineData(CourseTiming.Entrada)]
    [InlineData(CourseTiming.PlatoFuerte)]
    [InlineData(CourseTiming.Postre)]
    public void DefaultCourse_accepts_all_enum_values(CourseTiming c)
    {
        new Dish { DefaultCourse = c }.DefaultCourse.Should().Be(c);
    }
}
