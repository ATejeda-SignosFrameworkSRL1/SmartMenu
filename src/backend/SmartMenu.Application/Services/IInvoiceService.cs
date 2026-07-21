using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services;

public interface IInvoiceService
{
    /// <summary>Crea la factura global y la parte en una Order por franquicia, en una transacción.</summary>
    Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceDto dto);
    Task<InvoiceDto?> GetInvoiceByIdAsync(int id);
    /// <summary>Listado para el tracking del admin. Filtro opcional por nombre de DeliveryStatus.</summary>
    Task<IEnumerable<InvoiceDto>> GetTrackingAsync(string? deliveryStatus = null);
    /// <summary>Avanza el tracking. Si <paramref name="allowedCurrent"/> viene, la transición
    /// solo procede cuando el estado ACTUAL (leído en la misma transacción) está en la lista —
    /// guard autoritativo para el rol Delivery.</summary>
    Task<InvoiceDto> UpdateDeliveryStatusAsync(int id, string newStatus, IReadOnlyCollection<string>? allowedCurrent = null);

    /// <summary>Guarda la última posición GPS del repartidor (tracking en vivo del delivery).</summary>
    Task<InvoiceDto> UpdateDriverLocationAsync(int id, double lat, double lng);
}
