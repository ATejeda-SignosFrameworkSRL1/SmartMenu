namespace SmartMenu.Domain.Enums;

public enum UserRole
{
    Customer = 0,
    KitchenStaff = 1,
    Chef = 2,
    Waiter = 3,
    Host = 4,          // Hostess/Recepcionista (entrada)
    Cashier = 5,       // Cajero
    Manager = 6,
    Admin = 7,
    Bartender = 8,     // Personal de bar / KDS del bar
    Delivery = 9       // Repartidor (delivery-app): recoge y entrega pedidos del portal
}
