namespace SmartMenu.Application.Settings;

/// <summary>
/// Parámetros globales del sistema de reservas (fallbacks). Los campos de cada
/// <see cref="SmartMenu.Domain.Entities.ServicePeriod"/> tienen prioridad por turno.
/// Inyectado vía <see cref="Microsoft.Extensions.Options.IOptions{T}"/>.
/// </summary>
public class ReservationSettings
{
    public const string SectionName = "Reservations";

    /// <summary>Minutos de gracia tras la hora de reserva antes de marcar no-show.</summary>
    public int NoShowGraceMinutes { get; set; } = 15;

    /// <summary>Duración por defecto de la estadía (min) si el turno no la define.</summary>
    public int DefaultDurationMinutes { get; set; } = 90;

    /// <summary>Colchón de rotación por defecto (min) si el turno no lo define.</summary>
    public int TurnoverBufferMinutes { get; set; } = 10;

    /// <summary>Ventana mínima de anticipación para cancelar sin penalidad (min).</summary>
    public int CancellationWindowMinutes { get; set; } = 120;

    /// <summary>TTL del hold del portal público antes de expirar (min).</summary>
    public int HoldTtlMinutes { get; set; } = 10;

    /// <summary>Cada cuánto corre el barrido de ciclo de vida (no-show/holds/recordatorios), en segundos.</summary>
    public int SweepIntervalSeconds { get; set; } = 90;

    /// <summary>Offsets de recordatorio antes de la reserva (min). Ej. [1440, 120] = 24h y 2h antes.</summary>
    public int[] ReminderOffsetsMinutes { get; set; } = new[] { 1440, 120 };

    /// <summary>Cupos restantes en un slot por debajo de los cuales el estado pasa a "limited".</summary>
    public int LimitedThreshold { get; set; } = 4;

    /// <summary>STUB — si true se invoca IDepositService al reservar. Default false (sin depósitos en MVP).</summary>
    public bool RequireDeposit { get; set; } = false;
}
