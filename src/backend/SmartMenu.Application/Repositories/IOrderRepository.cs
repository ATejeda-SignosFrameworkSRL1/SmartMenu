using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.Application.Repositories;

public interface IOrderRepository : IRepository<Order>
{
    Task<Order?> GetByIdWithItemsAsync(int id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Order>> GetByTableIdAsync(int tableId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Order>> GetByStatusAsync(OrderStatus status, CancellationToken cancellationToken = default);
    Task<IEnumerable<Order>> GetActiveOrdersAsync(CancellationToken cancellationToken = default);
}
