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

    public static bool IsDrink(string? dishName)
    {
        if (string.IsNullOrWhiteSpace(dishName)) return false;
        var name = dishName.Trim().ToLowerInvariant();
        return DrinkKeywords.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase));
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

    private static void Header(EscPos b, string station, OrderDtoModel o, PrintAgentSettings s)
    {
        b.AlignCenter().Bold(true).DoubleSize(true).Line($"*** {station} ***").DoubleSize(false).Bold(false);
        b.AlignLeft().Line(Rule('=', s));
        b.Bold(true).Line($"Orden: #{o.OrderNumber}").Bold(false);
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
        Sub(b, "> ", it.Notes, s);
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
