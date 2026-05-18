using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class UploadController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<UploadController> _logger;

    public UploadController(IWebHostEnvironment env, ILogger<UploadController> logger)
    {
        _env = env;
        _logger = logger;
    }

    /// <summary>
    /// Subir imagen para un plato (reemplaza URL por archivo).
    /// </summary>
    [HttpPost("dish-image")]
    [RequestSizeLimit(10_485_760)] // 10 MB
    [DisableRequestSizeLimit]
    public async Task<IActionResult> UploadDishImage([FromForm] IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No se envió ningún archivo" });

        var allowed = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowed.Contains(file.ContentType.ToLowerInvariant()))
            return BadRequest(new { error = "Solo se permiten imágenes (JPEG, PNG, GIF, WebP)" });

        var webRoot = string.IsNullOrEmpty(_env.WebRootPath) ? Path.Combine(_env.ContentRootPath, "wwwroot") : _env.WebRootPath;
        var uploadsDir = Path.Combine(webRoot, "uploads", "dishes");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var fileName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);

        try
        {
            using (var stream = new FileStream(filePath, FileMode.Create))
                await file.CopyToAsync(stream);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving upload");
            return StatusCode(500, new { error = "Error al guardar la imagen" });
        }

        var url = $"/uploads/dishes/{fileName}";
        return Ok(new { url });
    }
}
