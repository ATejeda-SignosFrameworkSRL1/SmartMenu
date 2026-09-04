namespace SmartMenu.Application.Common;

public static class NameFormatting
{

    public static string? Initials(string? first, string? last)
    {
        var a = string.IsNullOrWhiteSpace(first) ? "" : first.Trim().Substring(0, 1);
        var b = string.IsNullOrWhiteSpace(last) ? "" : last.Trim().Substring(0, 1);
        var s = (a + b).ToUpperInvariant();
        return s.Length == 0 ? null : s;
    }

    public static string? FullName(string? first, string? last)
    {
        var s = $"{(first ?? "").Trim()} {(last ?? "").Trim()}".Trim();
        return s.Length == 0 ? null : s;
    }
}
