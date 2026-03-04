using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DishTagController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DishTagController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var tags = await _context.DishTags
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder)
            .Select(t => new { t.Id, t.Code, t.Label, t.Icon, t.SortOrder })
            .ToListAsync();
        return Ok(tags);
    }
}
