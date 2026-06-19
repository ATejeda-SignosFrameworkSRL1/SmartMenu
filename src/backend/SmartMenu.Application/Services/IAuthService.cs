using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IAuthService
{
    Task<AuthResultDto> RegisterAsync(RegisterDto dto, string? ip = null);
    Task<AuthResultDto> LoginAsync(LoginDto dto, string? ip = null);
    Task<AuthResultDto> RefreshAsync(string refreshToken, string? ip = null);
    Task<UserDto?> GetUserByEmailAsync(string email);
    /// <summary>
    /// Sprint 3 — Login por PIN del waiter en modo público.
    /// El PIN se busca contra todos los users con PinHash != null e IsActive=true.
    /// Devuelve un JWT corto (PIN_EXPIRATION_MINUTES) si match, o lanza UnauthorizedAccessException.
    /// </summary>
    Task<AuthResultDto> LoginByPinAsync(string pin, string? ip = null);
}
