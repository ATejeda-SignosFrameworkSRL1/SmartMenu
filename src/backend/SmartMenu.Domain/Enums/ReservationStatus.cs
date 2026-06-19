namespace SmartMenu.Domain.Enums;

/// <summary>
/// Estado del ciclo de vida de una reserva (modelo de capacidad dinámica por intervalo).
/// Es la fuente de verdad; los bool legacy <c>IsConfirmed</c>/<c>IsCancelled</c> se mantienen
/// sincronizados (dual-write) durante el período de transición.
/// </summary>
public enum ReservationStatus
{
    /// <summary>Creada / hold del portal público; aún sin confirmar. Cuenta contra el pool.</summary>
    Pending = 0,
    /// <summary>Confirmada en firme. Cuenta contra el pool.</summary>
    Confirmed = 1,
    /// <summary>El cliente llegó y fue sentado; ligada a una TableSession activa.</summary>
    Seated = 2,
    /// <summary>Sesión cerrada / experiencia completada.</summary>
    Completed = 3,
    /// <summary>No se presentó pasado el período de gracia; pool liberado.</summary>
    NoShow = 4,
    /// <summary>Cancelada explícitamente.</summary>
    Cancelled = 5,
    /// <summary>El hold expiró antes de confirmarse; pool liberado.</summary>
    Expired = 6,
}
