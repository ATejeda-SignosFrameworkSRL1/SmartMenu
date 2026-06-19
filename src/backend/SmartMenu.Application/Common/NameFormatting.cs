namespace SmartMenu.Application.Common;

/// <summary>
/// Helpers de formateo de nombres de personas (meseros, etc.) reutilizados por el plano de
/// planta y los hubs/servicios que difunden "quién atiende" una mesa.
/// </summary>
public static class NameFormatting
{
    /// <summary>
    /// Iniciales: primera letra del nombre + primera del apellido, en mayúscula
    /// (ej. "Karina Inmaculada" → "KI"). null si no hay nada utilizable.
    /// </summary>
    public static string? Initials(string? first, string? last)
    {
        var a = string.IsNullOrWhiteSpace(first) ? "" : first.Trim().Substring(0, 1);
        var b = string.IsNullOrWhiteSpace(last) ? "" : last.Trim().Substring(0, 1);
        var s = (a + b).ToUpperInvariant();
        return s.Length == 0 ? null : s;
    }

    /// <summary>Nombre completo "First Last" (recortado), o null si ambos vienen vacíos.</summary>
    public static string? FullName(string? first, string? last)
    {
        var s = $"{(first ?? "").Trim()} {(last ?? "").Trim()}".Trim();
        return s.Length == 0 ? null : s;
    }
}
