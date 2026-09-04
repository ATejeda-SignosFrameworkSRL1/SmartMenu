using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SmartMenu.Application.DTOs;
using SmartMenu.Application.Repositories;
using SmartMenu.Application.Services;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;
using BCrypt.Net;

namespace SmartMenu.Infrastructure.Services;

public class AuthService : IAuthService
{
    private const int RefreshTokenDays = 14;

    private readonly IUserRepository _userRepository;
    private readonly IConfiguration _configuration;
    private readonly ApplicationDbContext _db;

    public AuthService(IUserRepository userRepository, IConfiguration configuration, ApplicationDbContext db)
    {
        _userRepository = userRepository;
        _configuration = configuration;
        _db = db;
    }

    private static (bool Ok, string? Error) ValidatePasswordStrength(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
            return (false, "La contraseña debe tener al menos 12 caracteres.");
        if (!password.Any(char.IsUpper))
            return (false, "La contraseña debe incluir al menos una letra mayúscula.");
        if (!password.Any(char.IsLower))
            return (false, "La contraseña debe incluir al menos una letra minúscula.");
        if (!password.Any(char.IsDigit))
            return (false, "La contraseña debe incluir al menos un dígito.");
        if (password.All(char.IsLetterOrDigit))
            return (false, "La contraseña debe incluir al menos un carácter especial.");
        return (true, null);
    }

    public async Task<AuthResultDto> RegisterAsync(RegisterDto dto, string? ip = null)
    {
        var (strong, pwErr) = ValidatePasswordStrength(dto.Password);
        if (!strong)
            throw new InvalidOperationException(pwErr!);

        if (await _userRepository.EmailExistsAsync(dto.Email))
        {
            throw new InvalidOperationException("Email already registered");
        }

        var user = new User
        {
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Phone = dto.Phone,
            Role = UserRole.Customer,
            IsActive = true
        };

        await _userRepository.AddAsync(user);

        var accessToken = GenerateAccessToken(user);
        var refreshToken = await IssueRefreshTokenAsync(user.Id, ip);

        return new AuthResultDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            User = MapToUserDto(user)
        };
    }

    private const int MaxFailedAttempts = 5;
    private const int LockoutWindowMinutes = 15;

    public async Task<AuthResultDto> LoginAsync(LoginDto dto, string? ip = null)
    {
        var emailLower = (dto.Email ?? "").ToLowerInvariant();
        var windowStart = DateTime.UtcNow.AddMinutes(-LockoutWindowMinutes);

        var recentFailures = await _db.LoginAttempts
            .Where(la => la.Email == emailLower && !la.Success && la.AttemptedAt >= windowStart)
            .CountAsync();

        if (recentFailures >= MaxFailedAttempts)
            throw new UnauthorizedAccessException(
                $"Demasiados intentos fallidos. Espera {LockoutWindowMinutes} minutos antes de intentar de nuevo.");

        var user = await _userRepository.GetByEmailAsync(dto.Email);
        var pwOk = user != null && BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);

        _db.LoginAttempts.Add(new LoginAttempt
        {
            Email = emailLower,
            IpAddress = ip,
            Success = pwOk && (user?.IsActive ?? false),
            AttemptedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        if (user == null || !pwOk)
            throw new UnauthorizedAccessException("Invalid credentials");
        if (!user.IsActive)
            throw new UnauthorizedAccessException("User is inactive");

        var oldFailures = _db.LoginAttempts
            .Where(la => la.Email == emailLower && !la.Success && la.AttemptedAt < windowStart);
        _db.LoginAttempts.RemoveRange(oldFailures);
        await _db.SaveChangesAsync();

        if (user.Role == UserRole.Waiter)
        {
            var hasActiveShift = await _db.WaiterShifts.AnyAsync(s => s.WaiterId == user.Id && s.IsActive);
            if (!hasActiveShift)
            {
                _db.WaiterShifts.Add(new WaiterShift
                {
                    WaiterId = user.Id,
                    StartTime = DateTime.UtcNow,
                    IsActive = true,
                    Notes = "Auto-iniciado en login"
                });
                await _db.SaveChangesAsync();
            }
        }

        var accessToken = GenerateAccessToken(user);
        var refreshToken = await IssueRefreshTokenAsync(user.Id, ip);

        return new AuthResultDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            User = MapToUserDto(user)
        };
    }

    private const int PinExpirationMinutes = 60;
    private const int PinMaxFailedAttempts = 3;
    private const int PinLockoutMinutes = 5;

    public async Task<AuthResultDto> LoginByPinAsync(string pin, string? ip = null)
    {
        if (string.IsNullOrWhiteSpace(pin) || !System.Text.RegularExpressions.Regex.IsMatch(pin, "^[0-9]{6}$"))
            throw new UnauthorizedAccessException("PIN inválido (debe ser 6 dígitos)");

        var now = DateTime.UtcNow;
        var candidates = await _db.Users
            .Where(u => u.PinHash != null && u.IsActive
                        && (u.PinLockedUntil == null || u.PinLockedUntil < now))
            .ToListAsync();

        User? match = null;
        foreach (var u in candidates)
        {
            if (BCrypt.Net.BCrypt.Verify(pin, u.PinHash!))
            {
                match = u;
                break;
            }
        }

        if (match == null)
        {

            _db.LoginAttempts.Add(new LoginAttempt
            {
                Email = $"pin-failed:{ip ?? "unknown"}",
                IpAddress = ip,
                Success = false,
                AttemptedAt = now
            });
            await _db.SaveChangesAsync();
            throw new UnauthorizedAccessException("PIN incorrecto");
        }

        if (match.PinFailedAttempts > 0 || match.PinLockedUntil != null)
        {
            match.PinFailedAttempts = 0;
            match.PinLockedUntil = null;
        }
        _db.LoginAttempts.Add(new LoginAttempt
        {
            Email = $"pin-ok:{match.Email}",
            IpAddress = ip,
            Success = true,
            AttemptedAt = now
        });
        await _db.SaveChangesAsync();

        var accessToken = GenerateAccessTokenWithExpiration(match, PinExpirationMinutes, isPinAuth: true);
        return new AuthResultDto
        {
            AccessToken = accessToken,
            RefreshToken = string.Empty,
            User = MapToUserDto(match)
        };
    }

    public async Task<AuthResultDto> RefreshAsync(string refreshToken, string? ip = null)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            throw new UnauthorizedAccessException("Refresh token is required");

        var hash = HashToken(refreshToken);
        var stored = await _db.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.TokenHash == hash);

        if (stored is null)
            throw new UnauthorizedAccessException("Invalid refresh token");

        if (stored.RevokedAt != null)
        {
            var allActive = await _db.RefreshTokens.Where(rt => rt.UserId == stored.UserId && rt.RevokedAt == null).ToListAsync();
            foreach (var t in allActive) t.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            throw new UnauthorizedAccessException("Refresh token reuse detected — all sessions revoked");
        }

        if (DateTime.UtcNow >= stored.ExpiresAt)
            throw new UnauthorizedAccessException("Refresh token expired");

        var user = stored.User ?? throw new UnauthorizedAccessException("User no longer exists");
        if (!user.IsActive)
            throw new UnauthorizedAccessException("User is inactive");

        var newRefresh = await IssueRefreshTokenAsync(user.Id, ip);
        stored.RevokedAt = DateTime.UtcNow;
        stored.ReplacedByTokenHash = HashToken(newRefresh);
        await _db.SaveChangesAsync();

        var accessToken = GenerateAccessToken(user);
        return new AuthResultDto
        {
            AccessToken = accessToken,
            RefreshToken = newRefresh,
            User = MapToUserDto(user)
        };
    }

    private async Task<string> IssueRefreshTokenAsync(int userId, string? ip)
    {

        var bytes = RandomNumberGenerator.GetBytes(64);
        var plain = Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            TokenHash = HashToken(plain),
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays),
            CreatedByIp = ip
        });
        await _db.SaveChangesAsync();
        return plain;
    }

    private static string HashToken(string token)
    {
        var sha = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(sha);
    }

    private string GenerateAccessToken(User user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var expirationMinutes = int.Parse(jwtSettings["ExpirationMinutes"] ?? "60");
        return GenerateAccessTokenWithExpiration(user, expirationMinutes);
    }

    private string GenerateAccessTokenWithExpiration(User user, int expirationMinutes, bool isPinAuth = false)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secret = jwtSettings["Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
        var issuer = jwtSettings["Issuer"];
        var audience = jwtSettings["Audience"];

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        if (isPinAuth)
            claims.Add(new Claim("auth_method", "pin"));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expirationMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<UserDto?> GetUserByEmailAsync(string email)
    {
        var user = await _userRepository.GetByEmailAsync(email);
        return user == null ? null : MapToUserDto(user);
    }

    private UserDto MapToUserDto(User user)
    {
        return new UserDto
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
        };
    }
}
