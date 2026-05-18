namespace SmartMenu.Application.Settings;

/// <summary>
/// Tasas fiscales y de propina configurables (Ley 13-07 RD).
/// Inyectado vía <see cref="Microsoft.Extensions.Options.IOptions{T}"/>.
/// Defaults reflejan la legislación dominicana al 2026-05.
/// </summary>
public class BillingSettings
{
    public const string SectionName = "Billing";

    /// <summary>ITBIS (impuesto sobre la transferencia de bienes y servicios). Default 18 %.</summary>
    public decimal TaxRate { get; set; } = 0.18m;

    /// <summary>Propina legal obligatoria. Default 10 % (Ley 13-07).</summary>
    public decimal TipRate { get; set; } = 0.10m;

    /// <summary>Retención de ISR sobre la propina legal. Default 10 %.</summary>
    public decimal IsrOnTipRate { get; set; } = 0.10m;
}
