using Microsoft.AspNetCore.SignalR;

namespace SmartMenu.API.Hubs;

public class ReservationHub : Hub
{
    public async Task NotifyNewReservation(object reservationData)
    {
        await Clients.All.SendAsync("NewReservation", reservationData);
    }

    public async Task NotifyReservationConfirmed(int reservationId)
    {
        await Clients.All.SendAsync("ReservationConfirmed", new { reservationId, timestamp = DateTime.UtcNow });
    }

    public async Task NotifyReservationCancelled(int reservationId)
    {
        await Clients.All.SendAsync("ReservationCancelled", new { reservationId, timestamp = DateTime.UtcNow });
    }
}
