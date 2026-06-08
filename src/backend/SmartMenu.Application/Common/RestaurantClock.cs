namespace SmartMenu.Application.Common;

/// <summary>
/// Reloj del restaurante. El sistema guarda y transmite datetimes "naive-local" (hora RD,
/// sin sufijo Z) a propósito. Para comparaciones server-side (lead time, no-show, recordatorios)
/// se necesita "ahora" en hora local del restaurante, no UTC. RD usa AST = UTC-4 todo el año
/// (sin horario de verano).
/// </summary>
public static class RestaurantClock
{
    private static readonly TimeZoneInfo Tz = ResolveTimeZone();

    private static TimeZoneInfo ResolveTimeZone()
    {
        // .NET 6+ acepta IDs IANA y Windows en ambas plataformas, pero envolvemos por robustez.
        foreach (var id in new[] { "America/Santo_Domingo", "SA Western Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch { /* probar el siguiente */ }
        }
        // Fallback: UTC-4 fijo (RD no tiene DST).
        return TimeZoneInfo.CreateCustomTimeZone("RD-AST", TimeSpan.FromHours(-4), "RD (UTC-4)", "RD");
    }

    /// <summary>"Ahora" en hora local del restaurante (Kind = Unspecified, comparable con datetimes guardados naive-local).</summary>
    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Tz);

    /// <summary>Hoy en hora local del restaurante.</summary>
    public static DateOnly Today => DateOnly.FromDateTime(Now);

    /// <summary>Convierte un UTC explícito a hora local del restaurante.</summary>
    public static DateTime ToLocal(DateTime utc)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Tz);
}
