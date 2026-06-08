namespace SmartMenu.Domain.Enums;

/// <summary>
/// Tipo de ocasión de una reserva. Permite al restaurante anticipar
/// arreglos especiales (decoración, postre con vela, mesa privada, etc.)
/// y al host filtrar/contar reservas especiales en su panel.
/// </summary>
public enum OccasionType
{
    /// <summary>Reserva sin ocasión particular (default).</summary>
    Casual = 0,
    /// <summary>Cumpleaños — el restaurante prepara detalle especial.</summary>
    Birthday = 1,
    /// <summary>Aniversario de bodas / noviazgo.</summary>
    Anniversary = 2,
    /// <summary>Reunión de negocios — discreción, mesa apartada.</summary>
    Business = 3,
    /// <summary>Cena romántica / cita.</summary>
    Romantic = 4,
    /// <summary>Celebración familiar (graduación, baby shower, etc.).</summary>
    FamilyCelebration = 5,
    /// <summary>Otra ocasión (especificada en SpecialRequests).</summary>
    Other = 99,
}
