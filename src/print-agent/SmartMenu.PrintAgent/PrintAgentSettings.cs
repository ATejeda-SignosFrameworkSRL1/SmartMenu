namespace SmartMenu.PrintAgent;

/// <summary>
/// Configuracion del agente de impresion. Se enlaza desde la seccion "PrintAgent"
/// de appsettings.json y puede sobreescribirse por variables de entorno con el
/// prefijo PRINTAGENT__ (ej. PRINTAGENT__PRINTERNAME, PRINTAGENT__AUTH__PASSWORD).
/// </summary>
public sealed class PrintAgentSettings
{
    public const string SectionName = "PrintAgent";

    /// <summary>Base del backend (Caddy LAN). Debe exponer /api y /hubs.</summary>
    public string BackendUrl { get; set; } = "https://172.31.98.60:8443";

    public AuthSettings Auth { get; set; } = new();

    /// <summary>Nombre EXACTO de la impresora instalada en Windows.</summary>
    public string PrinterName { get; set; } = "2C-POS80-01-V6";

    /// <summary>true = un ticket para COCINA y otro para BAR (con corte entre ambos).
    /// false = un solo ticket con las dos secciones.</summary>
    public bool SplitTickets { get; set; } = true;

    /// <summary>Aceptar el certificado autofirmado de Caddy en la LAN.</summary>
    public bool IgnoreTlsErrors { get; set; } = true;

    /// <summary>Codepage para tildes/enie (858 = Latin-1 + euro; 850 / 437 alternativas).</summary>
    public int CodePage { get; set; } = 858;

    /// <summary>Ventana anti-duplicado: ignora reimpresiones de la misma orden dentro de N seg
    /// (evita doble impresion por reconexiones del hub).</summary>
    public int DedupSeconds { get; set; } = 10;

    /// <summary>Ancho en caracteres del papel (80mm Fuente A = 48; 58mm = 32).</summary>
    public int PaperWidthChars { get; set; } = 48;

    public sealed class AuthSettings
    {
        public string Email { get; set; } = "admin@smartmenu.com";
        public string Password { get; set; } = "Admin123!";
    }
}
