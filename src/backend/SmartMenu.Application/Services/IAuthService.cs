using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IAuthService
{
    Task<AuthResultDto> RegisterAsync(RegisterDto dto);
    Task<AuthResultDto> LoginAsync(LoginDto dto);
    Task<UserDto?> GetUserByEmailAsync(string email);
}
