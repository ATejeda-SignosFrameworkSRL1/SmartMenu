using System.Text;

namespace SmartMenu.PrintAgent;

/// <summary>
/// Decodifica bytes ESC/POS a texto legible (para el modo "preview"): conserva
/// saltos de linea, marca el corte y descarta las secuencias de control. No es
/// una emulacion fiel del papel, solo una ayuda para revisar el contenido.
/// </summary>
public static class Preview
{
    public static string Decode(byte[] bytes, Encoding enc)
    {
        var sb = new StringBuilder();
        var i = 0;
        while (i < bytes.Length)
        {
            var b = bytes[i];

            if (b == 0x1B) // ESC ...
            {
                if (i + 1 >= bytes.Length) break;
                var cmd = bytes[i + 1];
                var skip = cmd switch
                {
                    0x40 => 2,            // ESC @  init
                    0x74 or 0x61 or 0x45 or 0x64 or 0x21 => 3, // ESC t/a/E/d/!  con 1 parametro
                    _ => 2
                };
                i += skip;
                continue;
            }

            if (b == 0x1D) // GS ...
            {
                if (i + 1 >= bytes.Length) break;
                var cmd = bytes[i + 1];
                if (cmd == 0x56) // GS V m  -> corte
                {
                    sb.Append("\n--------[ CORTE / TICKET SEPARADO ]--------\n");
                    i += 3;
                    continue;
                }
                var skip = cmd == 0x21 ? 3 : 2; // GS ! n
                i += skip;
                continue;
            }

            if (b == 0x0A) { sb.Append('\n'); i++; continue; }

            sb.Append(enc.GetString(new[] { b }));
            i++;
        }
        return sb.ToString();
    }
}
