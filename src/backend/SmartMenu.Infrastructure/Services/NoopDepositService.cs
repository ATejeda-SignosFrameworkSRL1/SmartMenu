using SmartMenu.Application.Services;

namespace SmartMenu.Infrastructure.Services;

/// <summary>Implementación no-op de <see cref="IDepositService"/> para el MVP (sin cobro real).</summary>
public class NoopDepositService : IDepositService
{
    public Task<DepositResult> RequestDepositAsync(int reservationId, decimal amount, CancellationToken ct = default)
        => Task.FromResult(new DepositResult(DepositOutcome.Skipped));
}
