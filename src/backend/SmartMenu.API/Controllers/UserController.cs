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
[Authorize(Roles = "Admin,Manager")]
public class UserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UserController> _logger;

    public UserController(ApplicationDbContext context, ILogger<UserController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtener todos los usuarios (admin)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<UserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<UserDto>>> GetAllUsers()
    {
        try
        {
            var users = await _context.Users
                .Include(u => u.AssignedZone)
                .OrderBy(u => u.LastName)
                .ThenBy(u => u.FirstName)
                .ToListAsync();

            var dtos = users.Select(u => new UserDto
            {
                Id = u.Id,
                Email = u.Email,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Phone = u.Phone,
                Role = u.Role.ToString(),
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                AssignedZoneId = u.AssignedZoneId,
                AssignedZoneName = u.AssignedZone?.Name
            }).ToList();

            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users");
            return StatusCode(500, new { error = "Error al obtener usuarios" });
        }
    }

    /// <summary>
    /// Obtener usuario por ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserDto>> GetUser(int id)
    {
        var user = await _context.Users.Include(u => u.AssignedZone).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound(new { message = "Usuario no encontrado" });

        return Ok(new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Phone = user.Phone,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            AssignedZoneId = user.AssignedZoneId,
            AssignedZoneName = user.AssignedZone?.Name
        });
    }

    /// <summary>
    /// Crear usuario (admin)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { error = "Email y contraseña son requeridos" });

        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            return BadRequest(new { error = "Ya existe un usuario con ese email" });

        if (!Enum.TryParse<UserRole>(dto.Role ?? "Customer", true, out var role))
            role = UserRole.Customer;

        var user = new User
        {
            Email = dto.Email.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            FirstName = dto.FirstName ?? "",
            LastName = dto.LastName ?? "",
            Phone = dto.Phone,
            Role = role,
            IsActive = dto.IsActive ?? true,
            RestaurantId = dto.RestaurantId,
            AssignedZoneId = dto.AssignedZoneId
        };
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var zone = user.AssignedZoneId.HasValue ? await _context.Zones.FindAsync(user.AssignedZoneId) : null;
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Phone = user.Phone,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            AssignedZoneId = user.AssignedZoneId,
            AssignedZoneName = zone?.Name
        });
    }

    /// <summary>
    /// Actualizar usuario (admin)
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Usuario no encontrado" });

        if (!string.IsNullOrWhiteSpace(dto.Email) && dto.Email != user.Email)
        {
            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
                return BadRequest(new { error = "Ya existe un usuario con ese email" });
            user.Email = dto.Email.Trim();
        }
        if (dto.FirstName != null) user.FirstName = dto.FirstName;
        if (dto.LastName != null) user.LastName = dto.LastName;
        if (dto.Phone != null) user.Phone = dto.Phone;
        if (dto.IsActive.HasValue) user.IsActive = dto.IsActive.Value;
        if (!string.IsNullOrWhiteSpace(dto.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        if (!string.IsNullOrWhiteSpace(dto.Role) && Enum.TryParse<UserRole>(dto.Role, true, out var role))
            user.Role = role;
        if (dto.AssignedZoneId.HasValue)
            user.AssignedZoneId = dto.AssignedZoneId.Value == 0 ? null : dto.AssignedZoneId;

        await _context.SaveChangesAsync();

        var zone = user.AssignedZoneId.HasValue ? await _context.Zones.FindAsync(user.AssignedZoneId) : null;
        return Ok(new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Phone = user.Phone,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            AssignedZoneId = user.AssignedZoneId,
            AssignedZoneName = zone?.Name
        });
    }

    /// <summary>
    /// Eliminar usuario (admin)
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Usuario no encontrado" });

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateUserDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
    public int? RestaurantId { get; set; }
    public int? AssignedZoneId { get; set; }
}

public class UpdateUserDto
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
    public int? AssignedZoneId { get; set; }
}
