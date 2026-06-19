namespace SmartMenu.Application.Services;

public enum DepositOutcome
{
    /// <summary>No se solicitó depósito (configuración o política).</summary>
    Skipped,
    /// <summary>Se solicitó/inició el cobro del depósito.</summary>
    Requested,
    /// <summary>Falló la solicitud del depósito.</summary>
    Failed,
}

public record DepositResult(DepositOutcome Outcome, string? Reference = null);

/// <summary>
/// Seam de depósitos/garantía de reserva. En MVP la implementación es no-op
/// (retorna <see cref="DepositOutcome.Skipped"/>). Se conecta a Stripe en una fase posterior.
/// </summary>
public interface IDepositService
{
    Task<DepositResult> RequestDepositAsync(int reservationId, decimal amount, CancellationToken ct = default);
}
