namespace SmartMenu.Domain.Entities;

public class FloorStructure : BaseEntity
{
    public int ZoneId { get; set; }

    public string Type { get; set; } = "wall";

    public double X { get; set; }
    public double Y { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public string? Label { get; set; }
}
