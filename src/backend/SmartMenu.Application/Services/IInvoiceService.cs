using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IInvoiceService
{

    Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceDto dto);
    Task<InvoiceDto?> GetInvoiceByIdAsync(int id);

    Task<IEnumerable<InvoiceDto>> GetTrackingAsync(string? deliveryStatus = null);

    Task<InvoiceDto> UpdateDeliveryStatusAsync(int id, string newStatus, IReadOnlyCollection<string>? allowedCurrent = null);

    Task<InvoiceDto> UpdateDriverLocationAsync(int id, double lat, double lng);
}
