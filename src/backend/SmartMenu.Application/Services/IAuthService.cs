using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IAuthService
{
    Task<AuthResultDto> RegisterAsync(RegisterDto dto, string? ip = null);
    Task<AuthResultDto> LoginAsync(LoginDto dto, string? ip = null);
    Task<AuthResultDto> RefreshAsync(string refreshToken, string? ip = null);
    Task<UserDto?> GetUserByEmailAsync(string email);

    Task<AuthResultDto> LoginByPinAsync(string pin, string? ip = null);
}
