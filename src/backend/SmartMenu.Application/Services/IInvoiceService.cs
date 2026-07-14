using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IInvoiceService
{
    /// <summary>Crea la factura global y la parte en una Order por franquicia, en una transacción.</summary>
    Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceDto dto);
    Task<InvoiceDto?> GetInvoiceByIdAsync(int id);
    /// <summary>Listado para el tracking del admin. Filtro opcional por nombre de DeliveryStatus.</summary>
    Task<IEnumerable<InvoiceDto>> GetTrackingAsync(string? deliveryStatus = null);
    Task<InvoiceDto> UpdateDeliveryStatusAsync(int id, string newStatus);
}
