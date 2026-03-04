namespace SmartMenu.Domain.Enums;

/// <summary>
/// Tipo de división de cuenta para el cliente.
/// </summary>
public enum BillSplitType
{
    None = 0,       // Cuenta única
    ByTime = 1,     // Por tiempo (lo pedido en cada periodo)
    ByComensal = 2, // Por comensal (reparto igual o por persona)
    Proportional = 3, // Proporcional (cada uno paga lo que consumió)
    ByCategory = 4  // Por categoría (entradas, platos fuertes, etc.)
}
