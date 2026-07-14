namespace SmartMenu.Domain.Enums;

/// <summary>
/// Estado de seguimiento (tracking) de una <see cref="Entities.Invoice"/> delivery/pickup.
/// Es INDEPENDIENTE de <see cref="OrderStatus"/> (que es el ciclo de preparación por
/// franquicia en cada KDS): esta es la vista que el cliente/admin sigue de la entrega global.
/// </summary>
public enum DeliveryStatus
{
    Pending = 0,         // recibida, sin confirmar
    Confirmed = 1,       // confirmada; las franquicias empiezan a preparar
    Preparing = 2,       // en preparación
    ReadyForPickup = 3,  // lista para retirar (pickup) / lista para despachar
    OutForDelivery = 4,  // en camino (solo delivery)
    Delivered = 5,       // entregada / retirada
    Cancelled = 6
}
