using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CategoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CategoryController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.SortOrder,
                DishCount = c.Dishes.Count(d => d.IsAvailable)
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetCategory(int id)
    {
        var category = await _context.Categories
            .Include(c => c.Dishes.Where(d => d.IsAvailable))
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(new { message = "Category not found" });

        return Ok(new
        {
            category.Id,
            category.Name,
            category.Description,
            category.SortOrder,
            Dishes = category.Dishes.Select(d => new
            {
                d.Id,
                d.Name,
                d.Price,
                d.ImageUrl
            })
        });
    }
}
