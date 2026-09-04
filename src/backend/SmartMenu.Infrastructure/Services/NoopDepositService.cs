using SmartMenu.Application.Services;

namespace SmartMenu.Infrastructure.Services;

public class NoopDepositService : IDepositService
{
    public Task<DepositResult> RequestDepositAsync(int reservationId, decimal amount, CancellationToken ct = default)
        => Task.FromResult(new DepositResult(DepositOutcome.Skipped));
}
