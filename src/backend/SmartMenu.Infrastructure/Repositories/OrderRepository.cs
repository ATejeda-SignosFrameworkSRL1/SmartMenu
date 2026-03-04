using Microsoft.EntityFrameworkCore;
using SmartMenu.Application.Repositories;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using SmartMenu.Infrastructure.Data;

namespace SmartMenu.Infrastructure.Repositories;

public class OrderRepository : Repository<Order>, IOrderRepository
{
    public OrderRepository(ApplicationDbContext context) : base(context) { }

    public async Task<Order?> GetByIdWithItemsAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .ThenInclude(d => d!.Category)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .ThenInclude(d => d!.KitchenZone)
            .Include(o => o.Table)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
    }

    public async Task<IEnumerable<Order>> GetByTableIdAsync(int tableId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(o => o.Items)
            .Where(o => o.TableId == tableId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Order>> GetByStatusAsync(OrderStatus status, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .ThenInclude(d => d!.KitchenZone)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .ThenInclude(d => d!.Category)
            .Include(o => o.Table)
            .Where(o => o.Status == status)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Order>> GetActiveOrdersAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .ThenInclude(d => d!.KitchenZone)
            .Include(o => o.Items)
                .ThenInclude(i => i.Dish)
                .ThenInclude(d => d!.Category)
            .Include(o => o.Table)
            .Where(o => o.Status != OrderStatus.Completed && o.Status != OrderStatus.Cancelled)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }
}
