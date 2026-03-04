namespace SmartMenu.Domain.Entities;

public class DishDishTag
{
    public int DishId { get; set; }
    public int DishTagId { get; set; }

    public Dish Dish { get; set; } = null!;
    public DishTag DishTag { get; set; } = null!;
}
