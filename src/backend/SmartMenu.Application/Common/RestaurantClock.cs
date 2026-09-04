namespace SmartMenu.Application.Common;

public static class RestaurantClock
{
    private static readonly TimeZoneInfo Tz = ResolveTimeZone();

    private static TimeZoneInfo ResolveTimeZone()
    {

        foreach (var id in new[] { "America/Santo_Domingo", "SA Western Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch {  }
        }

        return TimeZoneInfo.CreateCustomTimeZone("RD-AST", TimeSpan.FromHours(-4), "RD (UTC-4)", "RD");
    }

    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Tz);

    public static DateOnly Today => DateOnly.FromDateTime(Now);

    public static DateTime ToLocal(DateTime utc)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Tz);
}
