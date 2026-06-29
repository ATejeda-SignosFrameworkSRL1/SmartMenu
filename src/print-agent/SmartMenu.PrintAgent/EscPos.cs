using System.Text;

namespace SmartMenu.PrintAgent;

/// <summary>
/// Constructor minimo de comandos ESC/POS (estandar Epson, compatible con la
/// mayoria de termicas 80mm tipo "POS80"). Acumula bytes y los entrega con ToArray().
/// </summary>
public sealed class EscPos
{
    private readonly MemoryStream _s = new();
    private readonly Encoding _enc;

    public EscPos(Encoding enc, byte codePageCmd)
    {
        _enc = enc;
        Raw(0x1B, 0x40);            // ESC @  -> inicializar
        Raw(0x1B, 0x74, codePageCmd); // ESC t n -> seleccionar tabla de caracteres
    }

    public EscPos Raw(params byte[] bytes) { _s.Write(bytes, 0, bytes.Length); return this; }

    public EscPos Text(string t) { var b = _enc.GetBytes(t); _s.Write(b, 0, b.Length); return this; }

    public EscPos Line(string t = "") => Text(t).Raw(0x0A);

    public EscPos AlignLeft() => Raw(0x1B, 0x61, 0x00);
    public EscPos AlignCenter() => Raw(0x1B, 0x61, 0x01);

    public EscPos Bold(bool on) => Raw(0x1B, 0x45, (byte)(on ? 1 : 0));

    /// <summary>Doble ancho + doble alto (titulares).</summary>
    public EscPos DoubleSize(bool on) => Raw(0x1D, 0x21, (byte)(on ? 0x11 : 0x00));

    /// <summary>Solo doble alto (lineas de plato).</summary>
    public EscPos DoubleHeight(bool on) => Raw(0x1D, 0x21, (byte)(on ? 0x01 : 0x00));

    public EscPos Feed(int n) { for (var i = 0; i < n; i++) Raw(0x0A); return this; }

    /// <summary>Avanza el papel y hace corte total (GS V 0).</summary>
    public EscPos Cut() => Feed(4).Raw(0x1D, 0x56, 0x00);

    public byte[] ToArray() => _s.ToArray();

    /// <summary>Mapea un codepage .NET al parametro de "ESC t n".</summary>
    public static byte CodePageCmd(int codePage) => codePage switch
    {
        437 => 0,
        850 => 2,
        860 => 3,
        863 => 4,
        865 => 5,
        852 => 18,
        858 => 19,
        1252 => 16,
        _ => 0,
    };
}
