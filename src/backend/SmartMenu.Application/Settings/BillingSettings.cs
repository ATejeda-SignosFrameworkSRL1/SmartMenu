namespace SmartMenu.Application.Settings;

public class BillingSettings
{
    public const string SectionName = "Billing";

    public decimal TaxRate { get; set; } = 0.18m;

    public decimal TipRate { get; set; } = 0.10m;

    public decimal IsrOnTipRate { get; set; } = 0.10m;
}
