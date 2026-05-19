using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IOrderService
{
    Task<OrderDto> CreateOrderAsync(CreateOrderDto dto);
    Task<OrderDto?> GetOrderByIdAsync(int id);
    Task<IEnumerable<OrderDto>> GetActiveOrdersAsync();
    Task<PagedResult<OrderDto>> GetActiveOrdersPagedAsync(int page, int pageSize);
    Task<IEnumerable<OrderDto>> GetAllOrdersAsync();
    Task<PagedResult<OrderDto>> GetAllOrdersPagedAsync(int page, int pageSize);
    Task<OrderDto> UpdateOrderStatusAsync(int id, string newStatus);
    Task<OrderDto> CancelOrderAsync(int id, string reason);
    Task MarkCustomerFinishedAsync(int orderId);
    Task AssignWaiterAsync(int orderId, int waiterId);
    Task UnassignWaiterAsync(int orderId);
    Task<IEnumerable<OrderDto>> GetUnassignedOrdersAsync();
    Task<PagedResult<OrderDto>> GetUnassignedOrdersPagedAsync(int page, int pageSize);
    Task<IEnumerable<OrderDto>> GetOrdersByWaiterAsync(int waiterId);
    Task<PagedResult<OrderDto>> GetOrdersByWaiterPagedAsync(int waiterId, int page, int pageSize);
    Task<OrderDto> SetKitchenPreparingAsync(int orderId);
    Task<OrderDto> SetKitchenReadyAsync(int orderId);
    Task<OrderDto> SetBarPreparingAsync(int orderId);
    Task<OrderDto> SetBarReadyAsync(int orderId);
    Task<OrderDto> SetKitchenServedAsync(int orderId);
    Task<OrderDto> SetBarServedAsync(int orderId);
    Task MoveOrderToTableAsync(int orderId, int newTableId);
    Task<OrderDto> AddItemsToOrderAsync(int orderId, List<CreateOrderItemDto> items);
}
