using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.Entities;

public class Table : BaseEntity
{
    public int TableNumber { get; set; }
    public int Capacity { get; set; }
    public int ZoneId { get; set; }
    public int RestaurantId { get; set; }
    public TableStatus Status { get; set; } = TableStatus.Available;
    public string QRCode { get; set; } = string.Empty;

    // ── Layout del plano de planta (Gestión de Salón) — nullable: no rompe mesas existentes ──
    /// <summary>Posición X (centro) en el lienzo del plano (px). Null = aún sin posicionar.</summary>
    public double? PositionX { get; set; }
    /// <summary>Posición Y (centro) en el lienzo del plano (px).</summary>
    public double? PositionY { get; set; }
    /// <summary>Forma en el plano: circle | square | rect | diamond | banquette.</summary>
    public string? Shape { get; set; }
    /// <summary>Ancho (px) para formas no circulares.</summary>
    public double? Width { get; set; }
    /// <summary>Alto (px) para formas no circulares.</summary>
    public double? Height { get; set; }
    /// <summary>Código de mozo/sección mostrado como badge (ej. "FR", "RO", "KI"). Solo diseño.</summary>
    public string? Server { get; set; }
    /// <summary>Nombre/etiqueta visible de la mesa (ej. "VIP-1", "Barra 2"). Null = usar el número.</summary>
    public string? Name { get; set; }
    /// <summary>Color manual de la mesa en el plano (hex). Null = usar el color por estado.</summary>
    public string? Color { get; set; }

    // Navigation properties
    public Zone Zone { get; set; } = null!;
    public Restaurant Restaurant { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
