using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace SmartMenu.PrintAgent;

/// <summary>
/// Logica de negocio del agente: login, traer la orden, repartir cocina/bar e imprimir.
/// No depende de SignalR (eso lo orquesta Program); asi se reusa en los modos "test" y "order".
/// </summary>
public sealed class ComandaService
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    private readonly PrintAgentSettings _s;
    private readonly ILogger<ComandaService> _log;
    private readonly HttpClient _http;
    private readonly Dictionary<int, DateTime> _recent = new();
    private readonly object _lock = new();

    public ComandaService(PrintAgentSettings settings, ILogger<ComandaService> log)
    {
        _s = settings;
        _log = log;

        var handler = new HttpClientHandler();
        if (_s.IgnoreTlsErrors)
            handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;

        _http = new HttpClient(handler)
        {
            BaseAddress = new Uri(_s.BackendUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(15)
        };
    }

    /// <summary>Inicia sesion y devuelve el accessToken (o null si falla).</summary>
    public async Task<string?> LoginAsync(CancellationToken ct)
    {
        try
        {
            var resp = await _http.PostAsJsonAsync("api/auth/login",
                new { email = _s.Auth.Email, password = _s.Auth.Password }, ct);
            resp.EnsureSuccessStatusCode();
            var body = await resp.Content.ReadFromJsonAsync<LoginResponse>(Json, ct);
            if (string.IsNullOrWhiteSpace(body?.AccessToken))
            {
                _log.LogError("Login sin accessToken en la respuesta.");
                return null;
            }
            _log.LogInformation("Login OK como {Email}", _s.Auth.Email);
            return body.AccessToken;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Login fallo contra {Url}", _s.BackendUrl);
            return null;
        }
    }

    /// <summary>Trae la orden por id e imprime su(s) comanda(s). Aplica anti-duplicado.</summary>
    public async Task PrintOrderAsync(int orderId)
    {
        if (IsDuplicate(orderId))
        {
            _log.LogInformation("Orden {Id} ignorada (reimpresion < {N}s).", orderId, _s.DedupSeconds);
            return;
        }

        OrderDtoModel? order;
        try
        {
            order = await _http.GetFromJsonAsync<OrderDtoModel>($"api/order/{orderId}", Json);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No se pudo traer la orden {Id}.", orderId);
            return;
        }

        if (order is null || order.Items.Count == 0)
        {
            _log.LogWarning("Orden {Id} sin items; nada que imprimir.", orderId);
            return;
        }

        PrintComanda(order);
    }

    public void PrintComanda(OrderDtoModel order)
    {
        var enc = ResolveEncoding();
        // Reparto por estacion: flag isDrink del backend (zona del plato) con
        // fallback a keywords para backends que no lo envien.
        var cocina = order.Items.Where(i => !Comanda.ItemIsDrink(i)).ToList();
        var bar = order.Items.Where(i => Comanda.ItemIsDrink(i)).ToList();

        if (_s.SplitTickets)
        {
            if (cocina.Count > 0) Send("COCINA", order, cocina, enc);
            if (bar.Count > 0) Send("BAR", order, bar, enc);
        }
        else
        {
            try
            {
                var bytes = Comanda.BuildCombined(order, cocina, bar, enc, _s);
                Print(bytes, $"Comanda {order.OrderNumber}");
                _log.LogInformation("Impreso ticket combinado orden {Order} (cocina {C}, bar {B}).",
                    order.OrderNumber, cocina.Count, bar.Count);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Fallo imprimiendo ticket combinado orden {Order}.", order.OrderNumber);
            }
        }
    }

    private void Send(string station, OrderDtoModel order, List<OrderItemModel> items, Encoding enc)
    {
        try
        {
            var bytes = Comanda.BuildTicket(station, order, items, enc, _s);
            Print(bytes, $"{station} {order.OrderNumber}");
            _log.LogInformation("Impreso ticket {Station} orden {Order} ({N} items).", station, order.OrderNumber, items.Count);
        }
        catch (Exception ex)
        {
            // Fail-safe: que el fallo de una estacion no tumbe la otra ni el agente.
            _log.LogError(ex, "Fallo imprimiendo {Station} orden {Order}.", station, order.OrderNumber);
        }
    }

    private void Print(byte[] bytes, string docName)
    {
        if (!OperatingSystem.IsWindows())
        {
            _log.LogWarning("Impresion RAW solo disponible en Windows; descartados {N} bytes ({Doc}).", bytes.Length, docName);
            return;
        }
        RawPrinterHelper.SendBytesToPrinter(_s.PrinterName, bytes, docName);
    }

    /// <summary>Imprime un ticket de prueba sin tocar el backend.</summary>
    public void PrintTestTicket()
    {
        PrintComanda(SampleOrder());
        _log.LogInformation("Ticket(s) de prueba enviado(s) a '{Printer}' (SplitTickets={Split}).", _s.PrinterName, _s.SplitTickets);
    }

    /// <summary>Orden de muestra para los modos "test" y "preview".</summary>
    public static OrderDtoModel SampleOrder() => new()
    {
        Id = 0,
        OrderNumber = "TEST-0001",
        TableNumber = "5",
        CreatedAt = DateTime.UtcNow,
        CustomerName = "Prueba",
        SpecialInstructions = "Ticket de prueba del agente de impresion",
        Items =
        {
            new OrderItemModel { DishName = "Hamburguesa Clasica", Quantity = 2, PreferenceText = "Termino: bien cocido", SideDish = "Papas fritas", Notes = "Sin cebolla", Allergies = "Mani", CustomerName = "Juan", CourseTiming = "PlatoFuerte" },
            new OrderItemModel { DishName = "Ensalada Cesar", Quantity = 1, CustomerName = "Ana", CourseTiming = "Entrada" },
            new OrderItemModel { DishName = "Coca Cola", Quantity = 2, CustomerName = "Juan" },
            new OrderItemModel { DishName = "Mojito", Quantity = 1, Notes = "Sin azucar", CustomerName = "Ana" }
        }
    };

    private bool IsDuplicate(int orderId)
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            foreach (var stale in _recent.Where(kv => (now - kv.Value).TotalSeconds > _s.DedupSeconds).Select(kv => kv.Key).ToList())
                _recent.Remove(stale);

            if (_recent.TryGetValue(orderId, out var when) && (now - when).TotalSeconds < _s.DedupSeconds)
                return true;

            _recent[orderId] = now;
            return false;
        }
    }

    private Encoding ResolveEncoding()
    {
        try { return Encoding.GetEncoding(_s.CodePage); }
        catch
        {
            _log.LogWarning("Codepage {Cp} no disponible; usando ASCII.", _s.CodePage);
            return Encoding.ASCII;
        }
    }
}
