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

    public async Task<AuthResultDto> RegisterAsync(RegisterDto dto, string? ip = null)
    {
        // Verificar si el email ya existe
        if (await _userRepository.EmailExistsAsync(dto.Email))
        {
            throw new InvalidOperationException("Email already registered");
        }

        // Crear usuario
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

    public async Task<AuthResultDto> LoginAsync(LoginDto dto, string? ip = null)
    {
        var user = await _userRepository.GetByEmailAsync(dto.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid credentials");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("User is inactive");

        var accessToken = GenerateAccessToken(user);
        var refreshToken = await IssueRefreshTokenAsync(user.Id, ip);

        return new AuthResultDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            User = MapToUserDto(user)
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

        // Detección de replay: si llega un token ya rotado, revocamos toda la cadena del usuario.
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

        // Rotación: marcar el actual como usado, emitir uno nuevo, encadenar.
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
        // 64 bytes aleatorios → base64url-safe.
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
        return Convert.ToHexString(sha); // 64 chars
    }

    private string GenerateAccessToken(User user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secret = jwtSettings["Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
        var issuer = jwtSettings["Issuer"];
        var audience = jwtSettings["Audience"];
        var expirationMinutes = int.Parse(jwtSettings["ExpirationMinutes"] ?? "60");

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

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
