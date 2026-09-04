using Microsoft.Extensions.Logging;
using SmartMenu.Application.Services;

namespace SmartMenu.Infrastructure.Services;

public class LoggingNotificationService : INotificationService
{
    private readonly ILogger<LoggingNotificationService> _logger;

    public LoggingNotificationService(ILogger<LoggingNotificationService> logger) => _logger = logger;

    public Task SendConfirmationAsync(int reservationId, CancellationToken ct = default)
    {
        _logger.LogInformation("[NOTIF stub] Confirmación de reserva {ReservationId}", reservationId);
        return Task.CompletedTask;
    }

    public Task SendReminderAsync(int reservationId, CancellationToken ct = default)
    {
        _logger.LogInformation("[NOTIF stub] Recordatorio de reserva {ReservationId}", reservationId);
        return Task.CompletedTask;
    }

    public Task SendNoShowAsync(int reservationId, CancellationToken ct = default)
    {
        _logger.LogInformation("[NOTIF stub] No-show de reserva {ReservationId}", reservationId);
        return Task.CompletedTask;
    }
}
