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
[Authorize]
public class UserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UserController> _logger;

    public UserController(ApplicationDbContext context, ILogger<UserController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Manager")]
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
                AssignedZoneName = u.AssignedZone?.Name,
                HasPin = !string.IsNullOrEmpty(u.PinHash),
                PinSetAt = u.PinSetAt
            }).ToList();

            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users");
            return StatusCode(500, new { error = "Error al obtener usuarios" });
        }
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,Manager")]
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
            AssignedZoneName = user.AssignedZone?.Name,
            HasPin = !string.IsNullOrEmpty(user.PinHash),
            PinSetAt = user.PinSetAt
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
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

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
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

    private int? GetActorIdFromJwt()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value
                  ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(sub, out var uid) && uid > 0 ? uid : (int?)null;
    }

    [HttpGet("{id}/deletion-impact")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDeletionImpact(int id)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { error = "Usuario no encontrado" });

        var deps = await CountUserDependenciesAsync(id);
        var totalDeps = deps.Orders + deps.TableSessions + deps.Reservations + deps.Payments
                        + deps.AuditEvents + deps.TableClaimRequests + deps.VirtualTables + deps.TableTransfers;
        var actorId = GetActorIdFromJwt();
        var isSelf = actorId.HasValue && actorId.Value == id;
        var lastAdmin = user.Role == UserRole.Admin
                        && !await _context.Users.AsNoTracking()
                              .AnyAsync(u => u.Id != id && u.Role == UserRole.Admin && u.IsActive);

        return Ok(new
        {
            userId = id,
            userName = $"{user.FirstName} {user.LastName}",
            role = user.Role.ToString(),
            isCurrentUser = isSelf,
            isLastActiveAdmin = lastAdmin,
            canHardDelete = totalDeps == 0 && !isSelf && !lastAdmin,
            willSoftDelete = totalDeps > 0 && !isSelf && !lastAdmin,
            isBlocked = isSelf || lastAdmin,
            blockedReason = isSelf
                ? "No puedes eliminar tu propio usuario"
                : (lastAdmin ? "No puedes eliminar al último administrador activo" : null),
            dependencies = new
            {
                orders = deps.Orders,
                tableSessions = deps.TableSessions,
                reservations = deps.Reservations,
                payments = deps.Payments,
                auditEvents = deps.AuditEvents,
                tableClaimRequests = deps.TableClaimRequests,
                virtualTables = deps.VirtualTables,
                tableTransfers = deps.TableTransfers,
                total = totalDeps
            }
        });
    }

    private record UserDeps(int Orders, int TableSessions, int Reservations, int Payments,
                            int AuditEvents, int TableClaimRequests, int VirtualTables, int TableTransfers);

    private async Task<UserDeps> CountUserDependenciesAsync(int userId)
    {

        return new UserDeps(
            Orders:             await _context.Orders.CountAsync(o => o.AssignedWaiterId == userId),
            TableSessions:      await _context.TableSessions.CountAsync(s => s.AssignedWaiterId == userId || s.AssignedByHostId == userId),
            Reservations:       await _context.TableReservations.CountAsync(r => r.CreatedByHostId == userId),
            Payments:           await _context.Payments.CountAsync(p => p.ProcessedByWaiterId == userId),
            AuditEvents:        await _context.AuditEvents.CountAsync(a => a.UserId == userId),
            TableClaimRequests: await _context.TableClaimRequests.CountAsync(c => c.WaiterId == userId || c.RespondedByAdminId == userId),
            VirtualTables:      await _context.VirtualTables.CountAsync(v => v.CreatedByWaiterId == userId),
            TableTransfers:     await _context.TableTransferRequests.CountAsync(t => t.FromWaiterId == userId || t.ToWaiterId == userId)
        );
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUser(int id, [FromQuery] bool force = false)
    {
        try
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { error = "Usuario no encontrado" });

            var actorId = GetActorIdFromJwt();
            if (actorId.HasValue && actorId.Value == id)
                return StatusCode(StatusCodes.Status403Forbidden,
                    new { error = "No puedes eliminar tu propio usuario. Pide a otro admin que lo haga." });

            if (user.Role == UserRole.Admin && user.IsActive)
            {
                var otherActiveAdmins = await _context.Users
                    .CountAsync(u => u.Id != id && u.Role == UserRole.Admin && u.IsActive);
                if (otherActiveAdmins == 0)
                    return StatusCode(StatusCodes.Status403Forbidden,
                        new { error = "No puedes eliminar al último administrador activo. Crea otro admin primero." });
            }

            var deps = await CountUserDependenciesAsync(id);
            var totalDeps = deps.Orders + deps.TableSessions + deps.Reservations + deps.Payments
                            + deps.AuditEvents + deps.TableClaimRequests + deps.VirtualTables + deps.TableTransfers;

            if (totalDeps == 0)
            {

                var rts = await _context.RefreshTokens.Where(rt => rt.UserId == id).ToListAsync();
                if (rts.Count > 0) _context.RefreshTokens.RemoveRange(rts);

                _context.Users.Remove(user);
                await _context.SaveChangesAsync();
                _logger.LogInformation("User {UserId} hard-deleted by admin {ActorId}", id, actorId);
                return Ok(new { mode = "hard", message = "Usuario eliminado permanentemente." });
            }

            var epoch = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var originalEmail = user.Email;
            user.IsActive = false;
            user.Email = $"deleted-{user.Id}-{epoch}+{originalEmail}";
            user.PinHash = null;
            user.PinSetAt = null;
            user.PinFailedAttempts = 0;
            user.PinLockedUntil = null;

            var tokens = await _context.RefreshTokens.Where(rt => rt.UserId == id).ToListAsync();
            if (tokens.Count > 0) _context.RefreshTokens.RemoveRange(tokens);

            await _context.SaveChangesAsync();
            _logger.LogInformation(
                "User {UserId} soft-deleted by admin {ActorId} (deps total={Total})",
                id, actorId, totalDeps);

            return Ok(new
            {
                mode = "soft",
                message = "Usuario desactivado. Se conservó su historial (órdenes, audit, pagos) por requerimiento fiscal DGII.",
                dependencies = new
                {
                    orders = deps.Orders,
                    payments = deps.Payments,
                    auditEvents = deps.AuditEvents,
                    total = totalDeps
                },
                emailReleased = originalEmail
            });
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "DbUpdateException deleting user {UserId}", id);
            return BadRequest(new
            {
                error = "No se pudo eliminar el usuario por restricción de base de datos. " +
                        "Intenta de nuevo o contacta a soporte."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user {UserId}", id);
            return StatusCode(500, new { error = "Error inesperado al eliminar el usuario." });
        }
    }

    [HttpPut("{id}/pin")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetUserPin(int id, [FromBody] SetPinDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Pin))
            return BadRequest(new { error = "PIN requerido" });
        if (!System.Text.RegularExpressions.Regex.IsMatch(dto.Pin, "^[0-9]{6}$"))
            return BadRequest(new { error = "PIN debe ser exactamente 6 dígitos numéricos" });

        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { error = "Usuario no encontrado" });

        if (user.RestaurantId.HasValue)
        {
            var conflict = await _context.Users
                .Where(u => u.Id != id
                            && u.RestaurantId == user.RestaurantId
                            && u.PinHash != null
                            && u.IsActive)
                .AsNoTracking()
                .ToListAsync();
            foreach (var other in conflict)
            {
                if (other.PinHash != null && BCrypt.Net.BCrypt.Verify(dto.Pin, other.PinHash))
                {
                    return Conflict(new { error = "Ese PIN ya está en uso por otro empleado del restaurante. Elige otro." });
                }
            }
        }

        user.PinHash = BCrypt.Net.BCrypt.HashPassword(dto.Pin);
        user.PinSetAt = DateTime.UtcNow;
        user.PinFailedAttempts = 0;
        user.PinLockedUntil = null;
        await _context.SaveChangesAsync();
        _logger.LogInformation("PIN updated for user {UserId} by admin", id);
        return NoContent();
    }

    [HttpDelete("{id}/pin")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveUserPin(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { error = "Usuario no encontrado" });
        user.PinHash = null;
        user.PinSetAt = null;
        user.PinFailedAttempts = 0;
        user.PinLockedUntil = null;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("me/pin")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangeMyPin([FromBody] ChangeMyPinDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Pin) || string.IsNullOrWhiteSpace(dto.CurrentPassword))
            return BadRequest(new { error = "PIN y password actual requeridos" });
        if (!System.Text.RegularExpressions.Regex.IsMatch(dto.Pin, "^[0-9]{6}$"))
            return BadRequest(new { error = "PIN debe ser exactamente 6 dígitos numéricos" });

        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                          ?? User.FindFirst("sub")?.Value;
        if (!int.TryParse(userIdClaim, out var uid))
            return Unauthorized();

        var user = await _context.Users.FindAsync(uid);
        if (user == null)
            return Unauthorized();
        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            return BadRequest(new { error = "Contraseña actual incorrecta" });

        if (user.RestaurantId.HasValue)
        {
            var others = await _context.Users
                .Where(u => u.Id != uid
                            && u.RestaurantId == user.RestaurantId
                            && u.PinHash != null
                            && u.IsActive)
                .AsNoTracking()
                .ToListAsync();
            foreach (var other in others)
            {
                if (other.PinHash != null && BCrypt.Net.BCrypt.Verify(dto.Pin, other.PinHash))
                    return Conflict(new { error = "Ese PIN ya está en uso por otro empleado. Elige otro." });
            }
        }

        user.PinHash = BCrypt.Net.BCrypt.HashPassword(dto.Pin);
        user.PinSetAt = DateTime.UtcNow;
        user.PinFailedAttempts = 0;
        user.PinLockedUntil = null;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("me/pin/status")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyPinStatus()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                          ?? User.FindFirst("sub")?.Value;
        if (!int.TryParse(userIdClaim, out var uid))
            return Unauthorized();
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == uid);
        if (user == null) return Unauthorized();
        return Ok(new
        {
            hasPin = !string.IsNullOrEmpty(user.PinHash),
            pinSetAt = user.PinSetAt,
            isLocked = user.PinLockedUntil.HasValue && user.PinLockedUntil.Value > DateTime.UtcNow,
            lockedUntil = user.PinLockedUntil,
        });
    }
}

public class SetPinDto
{

    public string Pin { get; set; } = string.Empty;
}

public class ChangeMyPinDto
{
    public string Pin { get; set; } = string.Empty;
    public string CurrentPassword { get; set; } = string.Empty;
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
