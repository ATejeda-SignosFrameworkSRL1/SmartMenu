namespace SmartMenu.Application.Services;

public enum DepositOutcome
{

    Skipped,

    Requested,

    Failed,
}

public record DepositResult(DepositOutcome Outcome, string? Reference = null);

public interface IDepositService
{
    Task<DepositResult> RequestDepositAsync(int reservationId, decimal amount, CancellationToken ct = default);
}
