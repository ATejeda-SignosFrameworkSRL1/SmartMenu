using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Default: protegido. GET es público (catálogo visible en menu).
public class DishTagController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DishTagController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [AllowAnonymous] // Customer-app muestra los tags (vegan/picante/etc) en el menú.
    public async Task<IActionResult> GetAll()
    {
        var tags = await _context.DishTags
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Label)
            .Select(t => new { t.Id, t.Code, t.Label, t.Icon, t.SortOrder, t.IsActive })
            .ToListAsync();
        return Ok(tags);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDishTagDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Label))
            return BadRequest(new { error = "El nombre es requerido" });

        var code = string.IsNullOrWhiteSpace(dto.Code)
            ? dto.Label.ToLower().Replace(" ", "_")
            : dto.Code.ToLower().Replace(" ", "_");

        if (await _context.DishTags.AnyAsync(t => t.Code == code))
            return BadRequest(new { error = "Ya existe un tag con ese código" });

        var tag = new DishTag
        {
            Code = code,
            Label = dto.Label.Trim(),
            Icon = dto.Icon?.Trim() ?? "🏷️",
            SortOrder = dto.SortOrder,
            IsActive = true,
        };

        _context.DishTags.Add(tag);
        await _context.SaveChangesAsync();
        return Ok(new { tag.Id, tag.Code, tag.Label, tag.Icon, tag.SortOrder, tag.IsActive });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateDishTagDto dto)
    {
        var tag = await _context.DishTags.FindAsync(id);
        if (tag == null) return NotFound(new { error = "Tag no encontrado" });

        if (!string.IsNullOrWhiteSpace(dto.Label)) tag.Label = dto.Label.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Icon))  tag.Icon  = dto.Icon.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Code))  tag.Code  = dto.Code.ToLower().Replace(" ", "_");
        tag.SortOrder = dto.SortOrder;

        await _context.SaveChangesAsync();
        return Ok(new { tag.Id, tag.Code, tag.Label, tag.Icon, tag.SortOrder, tag.IsActive });
    }

    [HttpPut("{id}/toggle")]
    public async Task<IActionResult> Toggle(int id)
    {
        var tag = await _context.DishTags.FindAsync(id);
        if (tag == null) return NotFound(new { error = "Tag no encontrado" });
        tag.IsActive = !tag.IsActive;
        await _context.SaveChangesAsync();
        return Ok(new { tag.Id, tag.IsActive });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var tag = await _context.DishTags.FindAsync(id);
        if (tag == null) return NotFound(new { error = "Tag no encontrado" });

        var inUse = await _context.DishDishTags.AnyAsync(d => d.DishTagId == id);
        if (inUse) return BadRequest(new { error = "No se puede eliminar: el tag está asignado a platos" });

        _context.DishTags.Remove(tag);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Tag eliminado" });
    }
}

public class CreateDishTagDto
{
    public string Label { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
}
