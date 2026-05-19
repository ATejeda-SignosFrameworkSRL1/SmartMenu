using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class UploadController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<UploadController> _logger;

    // S5.3 — variantes generadas automáticamente al subir.
    // _200 sirve para listings/cart; _400 para tarjeta de menú; el original queda como fallback / detalle.
    private static readonly (string Suffix, int Width)[] ThumbnailSizes = new[]
    {
        ("_200", 200),
        ("_400", 400),
    };

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
        var stem = Guid.NewGuid().ToString("N");
        var fileName = $"{stem}{ext}";
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

        // S5.3 — generar variantes _200 y _400 (JPEG, calidad 85). Si falla,
        // se loguea pero no rompe el upload — el original siempre sirve como fallback.
        var thumbnails = new Dictionary<string, string>();
        try
        {
            using var image = await Image.LoadAsync(filePath);
            foreach (var (suffix, width) in ThumbnailSizes)
            {
                var thumbName = $"{stem}{suffix}.jpg";
                var thumbPath = Path.Combine(uploadsDir, thumbName);
                using var clone = image.Clone(ctx => ctx.Resize(new ResizeOptions
                {
                    Size = new Size(width, 0),
                    Mode = ResizeMode.Max,
                }));
                await clone.SaveAsJpegAsync(thumbPath, new JpegEncoder { Quality = 85 });
                thumbnails[$"w{width}"] = $"/uploads/dishes/{thumbName}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate thumbnails for {File} — original será usado como fallback", fileName);
        }

        var url = $"/uploads/dishes/{fileName}";
        return Ok(new { url, thumbnails });
    }
}
