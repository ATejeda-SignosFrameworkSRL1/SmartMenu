using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SmartMenu.PrintAgent;

// Habilita codepages (858/850/437) para tildes y enie en la impresora.
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .AddEnvironmentVariables()
    .Build();

var settings = config.GetSection(PrintAgentSettings.SectionName).Get<PrintAgentSettings>() ?? new PrintAgentSettings();

using var loggerFactory = LoggerFactory.Create(b => b
    .AddSimpleConsole(o => { o.TimestampFormat = "HH:mm:ss "; o.SingleLine = true; })
    .SetMinimumLevel(LogLevel.Information));

var log = loggerFactory.CreateLogger("PrintAgent");
var service = new ComandaService(settings, loggerFactory.CreateLogger<ComandaService>());

// --- Modos de un solo disparo (utiles para probar) ---
if (args.Length > 0 && args[0].Equals("test", StringComparison.OrdinalIgnoreCase))
{
    log.LogInformation("Modo prueba: imprimiendo ticket(s) de muestra en '{Printer}'.", settings.PrinterName);
    service.PrintTestTicket();
    return;
}

if (args.Length > 0 && args[0].Equals("preview", StringComparison.OrdinalIgnoreCase))
{
    var order = ComandaService.SampleOrder();
    var enc = Encoding.GetEncoding(settings.CodePage);
    var cocina = order.Items.Where(i => !Comanda.ItemIsDrink(i)).ToList();
    var bar = order.Items.Where(i => Comanda.ItemIsDrink(i)).ToList();

    void Dump(string station, byte[] bytes)
    {
        Console.WriteLine($"\n========== TICKET {station} ({bytes.Length} bytes) ==========");
        Console.WriteLine(Preview.Decode(bytes, enc));
    }

    if (settings.SplitTickets)
    {
        if (cocina.Count > 0) Dump("COCINA", Comanda.BuildTicket("COCINA", order, cocina, enc, settings));
        if (bar.Count > 0) Dump("BAR", Comanda.BuildTicket("BAR", order, bar, enc, settings));
    }
    else
    {
        Dump("COMBINADO", Comanda.BuildCombined(order, cocina, bar, enc, settings));
    }
    return;
}

if (args.Length >= 2 && (args[0].Equals("order", StringComparison.OrdinalIgnoreCase) || args[0].Equals("reprint", StringComparison.OrdinalIgnoreCase)))
{
    if (int.TryParse(args[1], out var oid))
    {
        log.LogInformation("Modo reimpresion: orden {Id}.", oid);
        await service.PrintOrderAsync(oid);
    }
    else log.LogError("Id de orden invalido: {Arg}", args[1]);
    return;
}

// --- Modo normal: escuchar /hubs/kitchen e imprimir cada comanda ---
var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

string? token = null;
async Task<string?> GetTokenAsync()
{
    token ??= await service.LoginAsync(cts.Token);
    return token;
}

var hubUrl = $"{settings.BackendUrl.TrimEnd('/')}/hubs/kitchen";

while (!cts.IsCancellationRequested)
{
    HubConnection? conn = null;
    try
    {
        conn = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
            {
                options.AccessTokenProvider = GetTokenAsync;
                if (settings.IgnoreTlsErrors)
                {
                    options.HttpMessageHandlerFactory = _ => new HttpClientHandler
                    {
                        ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                    };
                    options.WebSocketConfiguration = ws =>
                        ws.RemoteCertificateValidationCallback = (_, _, _, _) => true;
                }
            })
            .WithAutomaticReconnect(new[]
            {
                TimeSpan.Zero, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(5),
                TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(30)
            })
            .Build();

        conn.On<JsonElement>("NewKitchenOrder", async payload =>
        {
            try
            {
                if (payload.TryGetProperty("orderId", out var idEl) && idEl.TryGetInt32(out var orderId))
                    await service.PrintOrderAsync(orderId);
                else
                    log.LogWarning("NewKitchenOrder sin orderId valido: {Payload}", payload.ToString());
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error procesando NewKitchenOrder.");
            }
        });

        conn.Reconnecting += _ => { log.LogWarning("Reconectando a /hubs/kitchen..."); return Task.CompletedTask; };
        conn.Reconnected += _ => { log.LogInformation("Reconectado a /hubs/kitchen."); return Task.CompletedTask; };

        var closed = new TaskCompletionSource();
        conn.Closed += _ => { closed.TrySetResult(); return Task.CompletedTask; };

        await conn.StartAsync(cts.Token);
        log.LogInformation("Conectado a {Url}. Esperando comandas... (Ctrl+C para salir)", hubUrl);

        using (cts.Token.Register(() => closed.TrySetResult()))
            await closed.Task;
    }
    catch (OperationCanceledException) { break; }
    catch (Exception ex)
    {
        log.LogError(ex, "Fallo de conexion al hub; reintentando en 5s.");
    }
    finally
    {
        if (conn is not null) await conn.DisposeAsync();
    }

    // Forzar re-login en el proximo intento (por si el token expiro).
    token = null;
    if (!cts.IsCancellationRequested)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(5), cts.Token); }
        catch (OperationCanceledException) { break; }
    }
}

log.LogInformation("Agente de impresion detenido.");
