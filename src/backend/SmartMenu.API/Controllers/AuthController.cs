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

        return Ok(user);
    }

    // Antes [AllowAnonymous]: cualquiera podía auto-registrarse y obtener token.
    // Ahora solo Admin/Manager crean cuentas (el staff se provisiona; el cliente QR es anónimo, no se registra).
    [HttpPost("register")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<AuthResultDto>> Register([FromBody] RegisterDto dto)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.RegisterAsync(dto, ip);
        return Ok(result);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResultDto>> Login([FromBody] LoginDto dto)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.LoginAsync(dto, ip);
        return Ok(result);
    }

    /// <summary>
    /// SPRINT 3 — Login por PIN del waiter (modo PUBLIC en device compartido).
    /// El device no necesita login previo; cualquier waiter del restaurante con PIN
    /// configurado puede autenticarse desde el numpad. JWT más corto (60 min) y
    /// SIN refresh token — al expirar hay que re-ingresar PIN.
    /// </summary>
    [HttpPost("pin-verify")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResultDto>> PinVerify([FromBody] PinVerifyDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Pin))
            return BadRequest(new { error = "PIN requerido" });
        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _authService.LoginByPinAsync(dto.Pin, ip);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Intercambia un refresh token vigente por un nuevo JWT + nuevo refresh
    /// (rotación). El refresh anterior queda revocado. Reuso de un token ya
    /// rotado revoca todas las sesiones del usuario (mitigación de replay).
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResultDto>> Refresh([FromBody] RefreshTokenDto dto)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.RefreshAsync(dto.RefreshToken, ip);
        return Ok(result);
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

        // S4.2 — política de contraseña: ≥12 chars + complexity (alineado con AuthService).
        var pw = dto.NewPassword ?? "";
        if (pw.Length < 12 || !pw.Any(char.IsUpper) || !pw.Any(char.IsLower) || !pw.Any(char.IsDigit) || pw.All(char.IsLetterOrDigit))
            return BadRequest(new { error = "La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, dígito y carácter especial." });

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

/// <summary>SPRINT 3 — DTO para login por PIN del waiter en modo PUBLIC.</summary>
public class PinVerifyDto
{
    /// <summary>PIN de exactamente 6 dígitos numéricos.</summary>
    public string Pin { get; set; } = string.Empty;
}
