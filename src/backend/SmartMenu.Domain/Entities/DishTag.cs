namespace SmartMenu.Domain.Entities;

/// <summary>
/// Tag para platos (picante, muy picante, etc.) con ícono.
/// </summary>
public class DishTag : BaseEntity
{
    public string Code { get; set; } = string.Empty;  // ej. "picante", "muy_picante"
    public string Label { get; set; } = string.Empty; // ej. "Picante", "Muy picante"
    public string Icon { get; set; } = string.Empty;  // emoji o nombre de ícono, ej. "🌶️"
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
