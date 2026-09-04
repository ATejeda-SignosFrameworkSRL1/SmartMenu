namespace SmartMenu.Application.DTOs;

public record RegisterDto
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Phone { get; init; }
}

public record LoginDto
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

public record RefreshTokenDto
{
    public string RefreshToken { get; init; } = string.Empty;
}

public record AuthResultDto
{
    public string AccessToken { get; init; } = string.Empty;
    public string RefreshToken { get; init; } = string.Empty;
    public UserDto User { get; init; } = null!;
}

public record UserDto
{
    public int Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public string Role { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
    public int? AssignedZoneId { get; init; }
    public string? AssignedZoneName { get; init; }

    public bool HasPin { get; init; }
    public DateTime? PinSetAt { get; init; }
}
