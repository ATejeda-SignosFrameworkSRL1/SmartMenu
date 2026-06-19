using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Application.DTOs;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Default: protegido. GETs marcados con [AllowAnonymous] son catálogo público para customer-app.
public class DishController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DishController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [AllowAnonymous] // Customer-app necesita listar el catálogo sin login (QR flow).
    public async Task<IActionResult> GetDishes([FromQuery] int? categoryId, [FromQuery] bool all = false, [FromQuery] int? page = null, [FromQuery] int pageSize = 50)
    {
        var query = _context.Dishes
            .AsNoTracking()
            .Include(d => d.Category)
            .Include(d => d.KitchenZone)
            .Include(d => d.DishTags)
            .ThenInclude(dt => dt.DishTag)
            .Include(d => d.Images)
            .AsSplitQuery()
            .AsQueryable();
        if (!all)
            query = query.Where(d => d.IsAvailable);
        if (categoryId.HasValue)
            query = query.Where(d => d.CategoryId == categoryId.Value);

        // Legacy: sin ?page devuelve array completo (compat).
        if (page is null)
        {
            var dishes = await query.OrderBy(d => d.Id).ToListAsync();
            return Ok(dishes.Select(d => MapToDishDto(d)).ToList());
        }

        // Paginado.
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;
        var total = await query.CountAsync();
        var items = await query.OrderBy(d => d.Id).Skip((page.Value - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<DishDto>
        {
            Items = items.Select(d => MapToDishDto(d)).ToList(),
            Page = page.Value, PageSize = pageSize, Total = total
        });
    }

    [HttpGet("{id}")]
    [AllowAnonymous] // Customer-app necesita ver detalle de plato sin login.
    public async Task<ActionResult<DishDto>> GetDish(int id)
    {
        var dish = await _context.Dishes
            .AsNoTracking()
            .Include(d => d.Category)
            .Include(d => d.KitchenZone)
            .Include(d => d.DishTags)
            .ThenInclude(dt => dt.DishTag)
            .Include(d => d.Images)
            .AsSplitQuery()
            .FirstOrDefaultAsync(d => d.Id == id);

        if (dish == null)
            return NotFound(new { message = "Dish not found" });

        return Ok(MapToDishDto(dish));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<DishDto>> CreateDish([FromBody] CreateDishDto dto)
    {
        var dish = new Dish
        {
            Name = dto.Name,
            Description = dto.Description,
            Price = dto.Price,
            CategoryId = dto.CategoryId,
            ImageUrl = dto.ImageUrl,
            IsAvailable = true,
            IsVegetarian = dto.IsVegetarian,
            IsVegan = dto.IsVegan,
            IsGlutenFree = dto.IsGlutenFree,
            PreparationTimeMinutes = dto.PreparationTimeMinutes,
            KitchenZoneId = dto.KitchenZoneId,
            DefaultCourse = dto.DefaultCourse
        };

        _context.Dishes.Add(dish);
        await _context.SaveChangesAsync();

        if (dto.TagIds != null && dto.TagIds.Count > 0)
        {
            foreach (var tagId in dto.TagIds)
            {
                if (await _context.DishTags.AnyAsync(t => t.Id == tagId))
                    _context.DishDishTags.Add(new DishDishTag { DishId = dish.Id, DishTagId = tagId });
            }
            await _context.SaveChangesAsync();
        }

        var created = await _context.Dishes
            .Include(d => d.Category)
            .Include(d => d.KitchenZone)
            .Include(d => d.DishTags)
            .ThenInclude(dt => dt.DishTag)
            .Include(d => d.Images)
            .FirstAsync(d => d.Id == dish.Id);
        return CreatedAtAction(nameof(GetDish), new { id = dish.Id }, MapToDishDto(created));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateDish(int id, [FromBody] CreateDishDto dto)
    {
        var dish = await _context.Dishes.Include(d => d.DishTags).FirstOrDefaultAsync(d => d.Id == id);
        if (dish == null)
            return NotFound(new { message = "Dish not found" });

        dish.Name = dto.Name;
        dish.Description = dto.Description;
        dish.Price = dto.Price;
        dish.CategoryId = dto.CategoryId;
        dish.ImageUrl = dto.ImageUrl;
        dish.IsVegetarian = dto.IsVegetarian;
        dish.IsVegan = dto.IsVegan;
        dish.IsGlutenFree = dto.IsGlutenFree;
        dish.PreparationTimeMinutes = dto.PreparationTimeMinutes;
        dish.KitchenZoneId = dto.KitchenZoneId;
        dish.DefaultCourse = dto.DefaultCourse;

        var newTagIds = dto.TagIds ?? new List<int>();
        var currentTagIds = dish.DishTags.Select(dt => dt.DishTagId).ToList();
        var toRemove = dish.DishTags.Where(dt => !newTagIds.Contains(dt.DishTagId)).ToList();
        foreach (var r in toRemove)
            _context.DishDishTags.Remove(r);
        foreach (var tagId in newTagIds.Except(currentTagIds))
        {
            if (await _context.DishTags.AnyAsync(t => t.Id == tagId))
                _context.DishDishTags.Add(new DishDishTag { DishId = id, DishTagId = tagId });
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteDish(int id)
    {
        // Soft delete: la DGII exige conservar histórico de productos vendidos.
        // El plato deja de aparecer en queries normales (via HasQueryFilter), pero los
        // OrderItem históricos siguen pudiéndose mostrar.
        var dish = await _context.Dishes.FindAsync(id);
        if (dish == null)
            return NotFound(new { message = "Dish not found" });

        if (dish.IsDeleted)
            return NoContent();

        dish.IsDeleted = true;
        dish.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id}/toggle-availability")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ToggleAvailability(int id)
    {
        var dish = await _context.Dishes.FindAsync(id);
        if (dish == null)
            return NotFound(new { message = "Dish not found" });

        dish.IsAvailable = !dish.IsAvailable;
        await _context.SaveChangesAsync();

        return Ok(new { isAvailable = dish.IsAvailable });
    }

    /// <summary>Add image to a dish</summary>
    [HttpPost("{id}/images")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> AddDishImage(int id, [FromBody] AddDishImageDto dto)
    {
        var dish = await _context.Dishes.Include(d => d.Images).FirstOrDefaultAsync(d => d.Id == id);
        if (dish == null) return NotFound(new { message = "Dish not found" });

        if (dto.IsMain)
        {
            foreach (var img in dish.Images) img.IsMain = false;
            dish.ImageUrl = dto.ImageUrl;
        }

        var image = new DishImage
        {
            DishId = id,
            ImageUrl = dto.ImageUrl,
            DisplayOrder = dto.DisplayOrder,
            IsMain = dto.IsMain
        };
        _context.DishImages.Add(image);
        await _context.SaveChangesAsync();

        return Ok(new { id = image.Id, imageUrl = image.ImageUrl, isMain = image.IsMain });
    }

    /// <summary>Delete an image from a dish</summary>
    [HttpDelete("{dishId}/images/{imageId}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteDishImage(int dishId, int imageId)
    {
        var image = await _context.DishImages.FirstOrDefaultAsync(i => i.Id == imageId && i.DishId == dishId);
        if (image == null) return NotFound();

        _context.DishImages.Remove(image);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Set main image</summary>
    [HttpPut("{dishId}/images/{imageId}/set-main")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> SetMainImage(int dishId, int imageId)
    {
        var dish = await _context.Dishes.Include(d => d.Images).FirstOrDefaultAsync(d => d.Id == dishId);
        if (dish == null) return NotFound();

        foreach (var img in dish.Images) img.IsMain = img.Id == imageId;
        var mainImg = dish.Images.FirstOrDefault(i => i.Id == imageId);
        if (mainImg != null) dish.ImageUrl = mainImg.ImageUrl;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Main image updated" });
    }

    private static DishDto MapToDishDto(Dish d)
    {
        return new DishDto
        {
            Id = d.Id,
            Name = d.Name,
            Description = d.Description,
            Price = d.Price,
            CategoryId = d.CategoryId,
            CategoryName = d.Category?.Name ?? "",
            ImageUrl = d.ImageUrl,
            IsAvailable = d.IsAvailable,
            IsVegetarian = d.IsVegetarian,
            IsVegan = d.IsVegan,
            IsGlutenFree = d.IsGlutenFree,
            PreparationTimeMinutes = d.PreparationTimeMinutes,
            KitchenZoneId = d.KitchenZoneId,
            KitchenZoneName = d.KitchenZone?.Name,
            DefaultCourse = d.DefaultCourse,
            Tags = (d.DishTags ?? new List<DishDishTag>())
                .Select(dt => new DishTagDto
                {
                    Id = dt.DishTag?.Id ?? 0,
                    Code = dt.DishTag?.Code ?? "",
                    Label = dt.DishTag?.Label ?? "",
                    Icon = dt.DishTag?.Icon ?? ""
                })
                .Where(t => t.Id != 0)
                .ToList(),
            Images = (d.Images ?? new List<DishImage>())
                .OrderBy(i => i.DisplayOrder)
                .Select(i => new DishImageDto
                {
                    Id = i.Id,
                    ImageUrl = i.ImageUrl,
                    DisplayOrder = i.DisplayOrder,
                    IsMain = i.IsMain
                })
                .ToList()
        };
    }
}

public class AddDishImageDto
{
    public string ImageUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; } = 0;
    public bool IsMain { get; set; } = false;
}
