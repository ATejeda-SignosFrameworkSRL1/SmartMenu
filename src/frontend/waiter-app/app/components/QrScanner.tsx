'use client';

import { useEffect, useRef, useState } from 'react';

/** Extrae el número de mesa o GUID del contenido del QR */
export function parseTableIdFromQrContent(text: string): number | string | null {
  const raw = (text || '').trim();
  
  // URL con GUID: .../table/a1b2c3d4-... o http://IP:3000/table/a1b2c3d4
  const matchGuidUrl = raw.match(/\/table\/([a-f0-9-]+)/i);
  if (matchGuidUrl && matchGuidUrl[1].length > 10) {
    // Es un GUID, devolver como string para buscar por qrCode
    return matchGuidUrl[1];
  }
  
  // GUID sin URL (32 o 36 caracteres alfanuméricos)
  if (/^[a-f0-9]{32}$/i.test(raw) || /^[a-f0-9-]{36}$/i.test(raw)) {
    return raw;
  }
  
  // URL con número: .../table/5 - ANTES que table-N para capturar URLs primero
  const matchUrlNum = raw.match(/\/table\/(\d+)/i);
  if (matchUrlNum) return parseInt(matchUrlNum[1], 10);
  
  // table-5 o table-12 (número)
  const matchTable = raw.match(/table[-_]?(\d+)/i);
  if (matchTable) return parseInt(matchTable[1], 10);
  
  // Solo número
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num) && num > 0) return num;
  
  return null;
}

interface QrScannerProps {
  onScan: (tableIdOrQrCode: number | string) => void;
  singleMode?: boolean;
  onError?: (message: string) => void;
  onClose?: () => void;
}

export function QrScanner({ onScan, singleMode = true, onError, onClose }: QrScannerProps) {
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`).current;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let Html5Qrcode: any = null;

    const run = async () => {
      try {
        Html5Qrcode = (await import('html5-qrcode')).Html5Qrcode;
        if (!mounted) return;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            console.log('🔍 QR Escaneado - Texto decodificado:', decodedText);
            const result = parseTableIdFromQrContent(decodedText);
            console.log('🔍 QR Escaneado - Resultado parseado:', result, 'Tipo:', typeof result);
            if (result != null) {
              console.log('✅ QR válido, llamando onScan con:', result);
              onScan(result);
              if (singleMode) {
                scanner.stop().catch(() => {});
                scannerRef.current = null;
              }
            } else {
              console.log('❌ QR no reconocido:', decodedText);
            }
          },
          () => {}
        );
        if (mounted) {
          setStatus('ready');
          setErrorMessage('');
        }
      } catch (e: any) {
        if (!mounted) return;
        setStatus('error');
        const raw = e?.message || '';
        const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;
        const isNotAllowed = /not allowed|permission denied|NotAllowedError|NotFoundError/i.test(raw);
        const msg = !isSecureContext || (isNotAllowed && !isSecureContext)
          ? 'En el móvil la cámara solo funciona con HTTPS. Abre la app con https://[tu-IP]:3003 (acepta el aviso del certificado) o escribe el número de mesa abajo.'
          : (raw || 'No se pudo acceder a la cámara');
        setErrorMessage(msg);
        onError?.(msg);
      }
    };

    run();
    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [containerId, singleMode, onScan, onError]);

  return (
    <div className="flex flex-col items-center">
      <div id={containerId} className="w-full max-w-[280px] overflow-hidden rounded-lg bg-black" />
      {status === 'loading' && <p className="mt-2 text-sm text-gray-600">Iniciando cámara...</p>}
      {status === 'error' && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <p className="text-xs text-gray-500">Usa el campo de abajo para escribir el número de mesa.</p>
        </div>
      )}
      {status === 'ready' && (
        <p className="mt-2 text-sm text-gray-600">
          {singleMode ? 'Apunta al QR de la mesa' : 'Escanea cada QR de mesa (se añadirán a la lista)'}
        </p>
      )}
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="mt-3 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Cerrar cámara
        </button>
      )}
    </div>
  );
}
