using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace SmartMenu.PrintAgent;

/// <summary>
/// Envia bytes crudos (RAW) a una impresora instalada en Windows via el spooler
/// (winspool.drv). Es el camino estandar para mandar ESC/POS a una termica USB:
/// los comandos pasan tal cual SOLO si el driver instalado es "Generic / Text Only"
/// o el driver ESC/POS del fabricante (un driver grafico los rasteriza y no funciona).
/// </summary>
[SupportedOSPlatform("windows")]
public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    private class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string? pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string? pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    /// <summary>Manda los bytes a la impresora por nombre. Lanza si no puede abrir/escribir.</summary>
    public static void SendBytesToPrinter(string printerName, byte[] bytes, string docName = "SmartMenu Comanda")
    {
        if (!OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
            throw new InvalidOperationException($"No se pudo abrir la impresora '{printerName}' (error {Marshal.GetLastWin32Error()}). Verifica el nombre exacto en Windows.");

        var ptr = Marshal.AllocCoTaskMem(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, ptr, bytes.Length);

            var di = new DOCINFOA { pDocName = docName, pDataType = "RAW" };
            if (!StartDocPrinter(hPrinter, 1, di))
                throw new InvalidOperationException($"StartDocPrinter fallo (error {Marshal.GetLastWin32Error()}).");
            try
            {
                if (!StartPagePrinter(hPrinter))
                    throw new InvalidOperationException($"StartPagePrinter fallo (error {Marshal.GetLastWin32Error()}).");
                try
                {
                    if (!WritePrinter(hPrinter, ptr, bytes.Length, out var written) || written != bytes.Length)
                        throw new InvalidOperationException($"WritePrinter escribio {written}/{bytes.Length} bytes (error {Marshal.GetLastWin32Error()}).");
                }
                finally { EndPagePrinter(hPrinter); }
            }
            finally { EndDocPrinter(hPrinter); }
        }
        finally
        {
            Marshal.FreeCoTaskMem(ptr);
            ClosePrinter(hPrinter);
        }
    }
}
