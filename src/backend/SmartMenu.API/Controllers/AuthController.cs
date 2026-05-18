using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Services;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ApplicationDbContext _context;

    public AuthController(IAuthService authService, ApplicationDbContext context)
    {
        _authService = authService;
        _context = context;
    }

    /// <summary>
    /// Obtener el usuario actual desde el token (por email). Devuelve el usuario actual de la BD con el id correcto.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(email))
            return Unauthorized(new { error = "Token inválido" });

        var user = await _authService.GetUserByEmailAsync(email);
        if (user == null)
            return Unauthorized(new { error = "Usuario no encontrado. Inicia sesión de nuevo." });

        Console.WriteLine($"🔐 /api/auth/me devolviendo: Id={user.Id}, Email={user.Email}, Role={user.Role}");
        return Ok(user);
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResultDto>> Register([FromBody] RegisterDto dto)
    {
        try
        {
            var result = await _authService.RegisterAsync(dto);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResultDto>> Login([FromBody] LoginDto dto)
    {
        try
        {
            var result = await _authService.LoginAsync(dto);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpPut("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(email))
            return Unauthorized(new { error = "Token inválido" });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return NotFound(new { error = "Usuario no encontrado" });

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            return BadRequest(new { error = "La contraseña actual es incorrecta" });

        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            return BadRequest(new { error = "La nueva contraseña debe tener al menos 6 caracteres" });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Contraseña actualizada correctamente" });
    }

    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health()
    {
        return Ok(new { status = "Auth service is running", timestamp = DateTime.UtcNow });
    }
}

public class ChangePasswordDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
