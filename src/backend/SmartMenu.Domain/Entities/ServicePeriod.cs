namespace SmartMenu.Domain.Entities;

/// <summary>
/// Turno de servicio (ej. "Almuerzo", "Cena"). Define la rejilla de slots reservables,
/// la duración estimada de la estadía, el colchón de rotación entre comensales, y los
/// topes de pacing por intervalo — el corazón de la "capacidad dinámica por intervalo temporal".
/// </summary>
public class ServicePeriod : BaseEntity
{
    public int RestaurantId { get; set; }

    /// <summary>Nombre visible del turno ("Almuerzo", "Cena").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Bitmask de días activos: Dom=1, Lun=2, Mar=4, Mié=8, Jue=16, Vie=32, Sáb=64. 127 = todos.
    /// Se evalúa con <c>(DaysOfWeekMask &amp; (1 &lt;&lt; (int)date.DayOfWeek)) != 0</c>.
    /// </summary>
    public int DaysOfWeekMask { get; set; } = 127;

    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    /// <summary>Granularidad de la rejilla de slots, en minutos (ej. 15, 30).</summary>
    public int SlotMinutes { get; set; } = 30;

    /// <summary>Duración estimada de la estadía (min) si no aplica la regla de party grande.</summary>
    public int DefaultDurationMinutes { get; set; } = 90;

    /// <summary>Colchón de limpieza/rotación tras la estadía antes de reusar la mesa.</summary>
    public int TurnoverBufferMinutes { get; set; } = 10;

    /// <summary>Tope de comensales que pueden INICIAR en un mismo slot (pacing). 0 = sin tope.</summary>
    public int MaxCoversPerSlot { get; set; } = 0;

    /// <summary>Tope de reservas que pueden INICIAR en un mismo slot (pacing). 0 = sin tope.</summary>
    public int MaxReservationsPerSlot { get; set; } = 0;

    /// <summary>Anticipación mínima para reservar (minutos desde "ahora").</summary>
    public int LeadTimeMinutes { get; set; } = 30;

    /// <summary>Horizonte máximo de reserva, en días.</summary>
    public int MaxHorizonDays { get; set; } = 60;

    public bool IsActive { get; set; } = true;

    /// <summary>Si party &gt;= este umbral, usa <see cref="LargePartyDurationMinutes"/>. NULL = sin regla especial.</summary>
    public int? LargePartyThreshold { get; set; }
    public int? LargePartyDurationMinutes { get; set; }

    public Restaurant? Restaurant { get; set; }
}
