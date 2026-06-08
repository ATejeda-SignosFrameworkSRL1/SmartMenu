'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Extrae el qrCode o tableId del contenido de un QR escaneado.
 * Acepta:
 *  - URL completa: https://X/table/{qrCode}
 *  - GUID hex 32 chars: 756958e9bbbf46d381dba253d37c2642
 *  - Número de mesa: "5", "table-5"
 */
export function parseQrContent(text: string): string | number | null {
  const raw = (text || '').trim();

  // URL con GUID en /table/{guid}
  const matchGuidUrl = raw.match(/\/table\/([a-f0-9-]+)/i);
  if (matchGuidUrl && matchGuidUrl[1].length > 10) return matchGuidUrl[1];

  // GUID solo
  if (/^[a-f0-9]{32}$/i.test(raw) || /^[a-f0-9-]{36}$/i.test(raw)) return raw;

  // URL con número /table/5
  const matchUrlNum = raw.match(/\/table\/(\d+)/i);
  if (matchUrlNum) return parseInt(matchUrlNum[1], 10);

  // table-N
  const matchTable = raw.match(/table[-_]?(\d+)/i);
  if (matchTable) return parseInt(matchTable[1], 10);

  // Solo número
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num) && num > 0) return num;

  return null;
}

interface QrScannerProps {
  onScan: (_result: string | number) => void;
  onError?: (_message: string) => void;
  onClose?: () => void;
}

/**
 * Componente de scanner QR usando html5-qrcode.
 * Pensado para cliente final en su celular — escanear el QR físico de una mesa.
 * Solo funciona en secure context (HTTPS o localhost).
 */
export function QrScanner({ onScan, onError, onClose }: QrScannerProps) {
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`).current;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let Html5Qrcode: any = null;

    const run = async () => {
      try {
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          throw new Error('NoSecureContext');
        }
        Html5Qrcode = (await import('html5-qrcode')).Html5Qrcode;
        if (!mountedRef.current) return;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        // Intentar cámara trasera primero
        let started = false;
        try {
          await scanner.start(
            { facingMode: { exact: 'environment' } } as any,
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decodedText: string) => {
              const parsed = parseQrContent(decodedText);
              if (parsed != null) {
                onScan(parsed);
                scanner.stop().catch(() => {});
                scannerRef.current = null;
              }
            },
            () => {}
          );
          started = true;
        } catch {
          // Fallback: cualquier cámara
          try {
            await scanner.start(
              { facingMode: 'environment' } as any,
              { fps: 10, qrbox: { width: 240, height: 240 } },
              (decodedText: string) => {
                const parsed = parseQrContent(decodedText);
                if (parsed != null) {
                  onScan(parsed);
                  scanner.stop().catch(() => {});
                  scannerRef.current = null;
                }
              },
              () => {}
            );
            started = true;
          } catch (e3: any) {
            throw e3;
          }
        }

        if (started && mountedRef.current) {
          setStatus('ready');
          setErrorMessage('');
        }
      } catch (e: any) {
        if (!mountedRef.current) return;
        setStatus('error');
        const raw = e?.message || '';
        let msg: string;
        if (raw === 'NoSecureContext' || !window.isSecureContext) {
          msg = 'La cámara requiere HTTPS. Abre la app vía nip.io o HTTPS válido.';
        } else if (/not allowed|permission denied|NotAllowedError/i.test(raw)) {
          msg = 'Permiso de cámara denegado. Toca el candado en la barra del navegador → Cámara → Permitir.';
        } else if (/NotFoundError|no camera/i.test(raw)) {
          msg = 'No se detectó cámara en este dispositivo.';
        } else {
          msg = raw || 'No se pudo acceder a la cámara';
        }
        setErrorMessage(msg);
        onError?.(msg);
      }
    };

    run();

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear?.();
        scannerRef.current = null;
      }
    };
  }, [containerId, onScan, onError]);

  return (
    <div className="flex flex-col items-center w-full">
      <div
        id={containerId}
        className="w-full max-w-[320px] aspect-square overflow-hidden rounded-2xl bg-black"
      />
      {status === 'loading' && (
        <p className="mt-3 text-sm text-gray-600">Iniciando cámara...</p>
      )}
      {status === 'ready' && (
        <p className="mt-3 text-sm text-gray-600">Apunta al código QR de tu mesa</p>
      )}
      {status === 'error' && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 max-w-sm">
          {errorMessage}
        </div>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-4 px-5 py-2.5 border-2 border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Cerrar cámara
        </button>
      )}
    </div>
  );
}
