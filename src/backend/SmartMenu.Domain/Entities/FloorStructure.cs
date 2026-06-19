namespace SmartMenu.Domain.Entities;

/// <summary>
/// Elemento arquitectónico/ambientación del plano de una zona (pared, barra,
/// columna, entrada). Solo diseño; se posiciona en el editor de Gestión de Salón.
/// Origen TOP-LEFT (x,y = esquina superior izquierda), a diferencia de las mesas (centro).
/// </summary>
public class FloorStructure : BaseEntity
{
    public int ZoneId { get; set; }

    /// <summary>wall | bar | column | entrance</summary>
    public string Type { get; set; } = "wall";

    public double X { get; set; }
    public double Y { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public string? Label { get; set; }
}
