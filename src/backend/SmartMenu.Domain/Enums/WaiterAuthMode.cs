namespace SmartMenu.Domain.Enums;

/// <summary>
/// Modo de autenticación del waiter-app a nivel restaurante.
/// Determina si los meseros usan login JWT personal, PIN compartido, o ambos.
/// </summary>
public enum WaiterAuthMode
{
    /// <summary>
    /// Solo login JWT personal — cada waiter ingresa con email+password en SU device.
    /// Apto para restaurantes con devices personales (uno por mesero).
    /// </summary>
    PrivateOnly = 0,

    /// <summary>
    /// Solo PIN — un device compartido (tablet de salón) donde cualquier waiter
    /// ingresa su PIN de 6 dígitos. JWT de "device" mantiene la sesión del turno.
    /// Apto para devices compartidos por estación/zona.
    /// </summary>
    PublicPin = 1,

    /// <summary>
    /// Híbrido — login JWT del device (turno) + PIN obligatorio para acciones sensibles
    /// (claim mesa, cerrar cuenta, descuentos). Combina auditabilidad con velocidad
    /// de handoff entre meseros. Recomendado para operaciones medianas/grandes.
    /// </summary>
    Hybrid = 2,
}
