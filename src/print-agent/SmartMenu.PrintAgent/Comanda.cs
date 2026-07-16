using System.Text;

namespace SmartMenu.PrintAgent;

/// <summary>
/// Arma los bytes ESC/POS de la comanda. El reparto cocina/bar usa la MISMA lista
/// de palabras clave que el backend (OrderService.DrinkKeywords) para que el ticket
/// de BAR coincida exactamente con lo que el sistema rutea al bar.
/// </summary>
public static class Comanda
{
    // Espejo de OrderService.DrinkKeywords (mantener en sync si cambia el backend).
    private static readonly string[] DrinkKeywords =
    [
        "cerveza", "vino", "cóctel", "refresco", "agua", "cafe", "té", "bebida",
        "margarita", "ron", "whisky", "colada", "piña colada", "mojito", "daiquiri",
        "soda", "jugo", "limonada", "batido", "smoothie", "copa", "trago", "coca", "pepsi"
    ];

    /// <summary>
    /// FASE 2 RUTEO — decide la estacion de un item: el flag isDrink que calcula el
    /// backend (zona del plato) MANDA; las keywords por nombre quedan solo como
    /// fallback para backends viejos que no envian el campo.
    /// </summary>
    public static bool ItemIsDrink(OrderItemModel item) => item.IsDrink ?? IsDrink(item.DishName);

    public static bool IsDrink(string? dishName)
    {
        if (string.IsNullOrWhiteSpace(dishName)) return false;
        var name = dishName.Trim().ToLowerInvariant();
        // Match por PALABRA completa (con plurales), no substring: 'agua' no debe
        // matchear 'aguacate' ni 'ron' a 'macarrones'. Mantener en sync con
        // OrderService.IsDrinkDish del backend y el isDrinkItem de los frontends.
        var words = System.Text.RegularExpressions.Regex
            .Split(name, "[^a-záéíóúüñ]+")
            .Where(w => w.Length > 0)
            .ToHashSet();
        return DrinkKeywords.Any(k => k.Contains(' ')
            ? name.Contains(k, StringComparison.Ordinal)
            : words.Contains(k) || words.Contains(k + "s") || words.Contains(k + "es"));
    }

    /// <summary>Ticket de una sola estacion (COCINA o BAR).</summary>
    public static byte[] BuildTicket(string station, OrderDtoModel o, List<OrderItemModel> items, Encoding enc, PrintAgentSettings s)
    {
        var b = new EscPos(enc, EscPos.CodePageCmd(s.CodePage));
        Header(b, station, o, s);
        foreach (var it in items) Item(b, it, s);
        Footer(b);
        return b.ToArray();
    }

    /// <summary>Ticket unico con seccion COCINA y seccion BAR (cuando SplitTickets = false).</summary>
    public static byte[] BuildCombined(OrderDtoModel o, List<OrderItemModel> cocina, List<OrderItemModel> bar, Encoding enc, PrintAgentSettings s)
    {
        var b = new EscPos(enc, EscPos.CodePageCmd(s.CodePage));
        Header(b, "COMANDA", o, s);
        if (cocina.Count > 0)
        {
            Section(b, "COCINA", s);
            foreach (var it in cocina) Item(b, it, s);
        }
        if (bar.Count > 0)
        {
            Section(b, "BAR", s);
            foreach (var it in bar) Item(b, it, s);
        }
        Footer(b);
        return b.ToArray();
    }

    private const string TakeawayTag = "PARA LLEVAR";

    /// <summary>Detecta si la orden es PARA LLEVAR: marca por ítem en Notes (lo que manda
    /// el client), o IsPickup, o nota de orden. No depende de columnas nuevas en la BD.</summary>
    private static bool IsTakeawayOrder(OrderDtoModel o) =>
        o.IsPickup
        || (o.SpecialInstructions?.Contains(TakeawayTag, StringComparison.OrdinalIgnoreCase) ?? false)
        || (o.Items?.Any(i => i.Notes?.Contains(TakeawayTag, StringComparison.OrdinalIgnoreCase) ?? false) ?? false);

    /// <summary>Quita el marcador "PARA LLEVAR" de la nota del ítem para que la línea se lea
    /// limpia — el encabezado ya avisa que el pedido es para llevar.</summary>
    private static string? CleanNote(string? note)
    {
        if (string.IsNullOrWhiteSpace(note)) return note;
        var cleaned = System.Text.RegularExpressions.Regex.Replace(
            note, @"🥡?\s*PARA LLEVAR\s*[·\-—|]?\s*", "",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static void Header(EscPos b, string station, OrderDtoModel o, PrintAgentSettings s)
    {
        // PEDIDO PARA LLEVAR: encabezado prominente ANTES de todo lo demás.
        if (IsTakeawayOrder(o))
        {
            b.AlignCenter().Bold(true).Line("*** PEDIDO ***")
             .DoubleSize(true).Line("PARA LLEVAR").DoubleSize(false).Bold(false).AlignLeft();
            b.Line(Rule('=', s));
        }
        b.AlignCenter().Bold(true).DoubleSize(true).Line($"*** {station} ***").DoubleSize(false).Bold(false);
        b.AlignLeft().Line(Rule('=', s));
        b.Bold(true).Line($"Orden: #{ShortOrder(o.OrderNumber)}").Bold(false);
        var mesa = o.IsPickup || string.IsNullOrWhiteSpace(o.TableNumber) ? "PARA LLEVAR" : $"Mesa {o.TableNumber}";
        b.DoubleSize(true).Line(mesa).DoubleSize(false);
        b.Line($"Hora: {o.CreatedAt.ToLocalTime():HH:mm  dd/MM}");
        if (!string.IsNullOrWhiteSpace(o.CustomerName)) b.Line($"Cliente: {o.CustomerName}");
        if (!string.IsNullOrWhiteSpace(o.SpecialInstructions))
            foreach (var l in Wrap($"Nota orden: {o.SpecialInstructions}", s.PaperWidthChars)) b.Line(l);
        b.Line(Rule('=', s));
    }

    private static void Section(EscPos b, string title, PrintAgentSettings s)
    {
        b.AlignCenter().Bold(true).Line($"--- {title} ---").Bold(false).AlignLeft();
    }

    private static void Item(EscPos b, OrderItemModel it, PrintAgentSettings s)
    {
        b.Bold(true).DoubleHeight(true).Line($"{it.Quantity}x {it.DishName}").DoubleHeight(false).Bold(false);

        Sub(b, "> ", it.PreferenceText, s);
        Sub(b, "> Acomp: ", it.SideDish, s);
        Sub(b, "> ", CleanNote(it.Notes), s);
        Sub(b, "> Curso: ", PrettyCourse(it.CourseTiming), s);

        if (!string.IsNullOrWhiteSpace(it.Allergies))
        {
            b.Bold(true);
            foreach (var l in Wrap($"  !! ALERGIA: {it.Allergies} !!", s.PaperWidthChars)) b.Line(l);
            b.Bold(false);
        }

        Sub(b, "> Comensal: ", it.CustomerName, s);
        b.Line(Rule('-', s));
    }

    private static void Sub(EscPos b, string label, string? value, PrintAgentSettings s)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        foreach (var l in Wrap($"  {label}{value}", s.PaperWidthChars)) b.Line(l);
    }

    private static void Footer(EscPos b)
    {
        b.AlignCenter().Line().Line("-- fin --");
        b.Cut();
    }

    private static string Rule(char c, PrintAgentSettings s) => new(c, Math.Max(8, s.PaperWidthChars));

    /// <summary>Codigo corto que ve el staff en la mesa (mismo criterio que shortOrder
    /// del waiter app: ultimo segmento tras '-', en mayusculas). Ej: ORD-...-de6661 -> DE6661.</summary>
    private static string ShortOrder(string? orderNumber)
    {
        if (string.IsNullOrWhiteSpace(orderNumber)) return "";
        var parts = orderNumber.Split('-');
        return parts[^1].ToUpperInvariant();
    }

    private static string? PrettyCourse(string? course) => course switch
    {
        null or "" => null,
        "Entrada" => "Entrada",
        "PlatoFuerte" => "Plato fuerte",
        "Postre" => "Postre",
        _ => course
    };

    /// <summary>Ajusta texto al ancho del papel respetando palabras.</summary>
    private static IEnumerable<string> Wrap(string text, int width)
    {
        text = text.Replace('\r', ' ').Replace('\n', ' ').Trim();
        if (text.Length == 0) yield break;

        var sb = new StringBuilder();
        foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (sb.Length == 0) sb.Append(word);
            else if (sb.Length + 1 + word.Length <= width) sb.Append(' ').Append(word);
            else { yield return sb.ToString(); sb.Clear(); sb.Append(word); }

            while (sb.Length > width)
            {
                yield return sb.ToString(0, width);
                var rest = sb.ToString(width, sb.Length - width);
                sb.Clear();
                sb.Append(rest);
            }
        }
        if (sb.Length > 0) yield return sb.ToString();
    }
}
