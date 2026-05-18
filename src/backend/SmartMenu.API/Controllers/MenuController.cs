using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MenuController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MenuController> _logger;

    public MenuController(ApplicationDbContext context, ILogger<MenuController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtener menú completo con categorías y platillos
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenu()
    {
        try
        {
            var categories = await _context.Categories
                .Where(c => c.IsActive)
                .Include(c => c.Dishes.Where(d => d.IsAvailable))
                .OrderBy(c => c.SortOrder)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Description,
                    c.SortOrder,
                    Dishes = c.Dishes.Select(d => new
                    {
                        d.Id,
                        d.Name,
                        d.Description,
                        d.Price,
                        d.ImageUrl,
                        d.IsAvailable,
                        d.IsVegetarian,
                        d.IsVegan,
                        d.IsGlutenFree,
                        d.PreparationTimeMinutes
                    }).ToList()
                })
                .ToListAsync();

            _logger.LogInformation("Menu retrieved successfully with {Count} categories", categories.Count);
            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting menu");
            return StatusCode(500, new { error = "Error al obtener menú" });
        }
    }

    /// <summary>
    /// Obtener menú por restaurante
    /// </summary>
    [HttpGet("restaurant/{restaurantId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuByRestaurant(int restaurantId)
    {
        try
        {
            var categories = await _context.Categories
                .Include(c => c.Menu)
                .Where(c => c.Menu.RestaurantId == restaurantId && c.IsActive)
                .Include(c => c.Dishes.Where(d => d.IsAvailable))
                .OrderBy(c => c.SortOrder)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Description,
                    c.SortOrder,
                    Dishes = c.Dishes.Select(d => new
                    {
                        d.Id,
                        d.Name,
                        d.Description,
                        d.Price,
                        d.ImageUrl,
                        d.IsAvailable,
                        d.IsVegetarian,
                        d.IsVegan,
                        d.IsGlutenFree,
                        d.PreparationTimeMinutes
                    }).ToList()
                })
                .ToListAsync();

            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting menu for restaurant {RestaurantId}", restaurantId);
            return StatusCode(500, new { error = "Error al obtener menú" });
        }
    }
}
