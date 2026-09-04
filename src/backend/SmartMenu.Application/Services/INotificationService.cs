namespace SmartMenu.Application.Services;

public interface INotificationService
{

    Task SendConfirmationAsync(int reservationId, CancellationToken ct = default);

    Task SendReminderAsync(int reservationId, CancellationToken ct = default);

    Task SendNoShowAsync(int reservationId, CancellationToken ct = default);
}
