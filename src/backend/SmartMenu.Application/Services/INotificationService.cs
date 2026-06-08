namespace SmartMenu.Application.Services;

/// <summary>
/// Seam de comunicaciones (email/SMS/WhatsApp). En MVP la implementación es un stub
/// que solo registra en el log; un proveedor real (SendGrid/Twilio) se conecta luego
/// cambiando únicamente el registro DI.
/// </summary>
public interface INotificationService
{
    /// <summary>Confirmación de reserva (al confirmar). Incluye el código de confirmación.</summary>
    Task SendConfirmationAsync(int reservationId, CancellationToken ct = default);

    /// <summary>Recordatorio previo a la reserva (T-24h / T-2h).</summary>
    Task SendReminderAsync(int reservationId, CancellationToken ct = default);

    /// <summary>Aviso de no-show (al cliente y/o al staff).</summary>
    Task SendNoShowAsync(int reservationId, CancellationToken ct = default);
}
