'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

export function parseTableIdFromQrContent(text: string): number | string | null {
  const raw = (text || '').trim();

  const matchGuidUrl = raw.match(/\/table\/([a-f0-9-]+)/i);
  if (matchGuidUrl && matchGuidUrl[1].length > 10) {
    return matchGuidUrl[1];
  }

  if (/^[a-f0-9]{32}$/i.test(raw) || /^[a-f0-9-]{36}$/i.test(raw)) {
    return raw;
  }

  const matchUrlNum = raw.match(/\/table\/(\d+)/i);
  if (matchUrlNum) return parseInt(matchUrlNum[1], 10);

  const matchTable = raw.match(/table[-_]?(\d+)/i);
  if (matchTable) return parseInt(matchTable[1], 10);

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

type Status = 'init' | 'requesting' | 'ready' | 'error' | 'no-https' | 'no-camera';

export function QrScanner({ onScan, singleMode = true, onError, onClose }: QrScannerProps) {
  const t = useTranslations('scanner');
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`).current;
  const [status, setStatus] = useState<Status>('init');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [manualValue, setManualValue] = useState<string>('');
  const [attempt, setAttempt] = useState(0);
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const [isSecureContext, setIsSecureContext] = useState<boolean>(true);
  const [currentHostUrl, setCurrentHostUrl] = useState<string>('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecureContext(window.isSecureContext);
      setCurrentHostUrl(window.location.host);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const run = async () => {
      try {
        setStatus('requesting');

        if (typeof window !== 'undefined' && !window.isSecureContext) {
          if (mountedRef.current) {
            setStatus('no-https');
            setErrorMessage(t('permissionDenied'));
          }
          return;
        }

        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mountedRef.current) return;

        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        let started = false;
        try {
          await scanner.start(
            { facingMode: { exact: 'environment' } } as any,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText: string) => handleDecode(decodedText, scanner),
            () => {}
          );
          started = true;
        } catch (e1: any) {

          try {
            await scanner.start(
              { facingMode: 'environment' } as any,
              { fps: 10, qrbox: { width: 220, height: 220 } },
              (decodedText: string) => handleDecode(decodedText, scanner),
              () => {}
            );
            started = true;
          } catch (e2: any) {

            try {
              const cameras = await Html5Qrcode.getCameras();
              if (!cameras || cameras.length === 0) {
                throw new Error('NotFoundError: no camera detected');
              }

              const target = cameras.find(c => /back|rear|environment/i.test(c.label || '')) || cameras[0];
              await scanner.start(
                target.id,
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decodedText: string) => handleDecode(decodedText, scanner),
                () => {}
              );
              started = true;
            } catch (e3: any) {
              throw e3;
            }
          }
        }

        if (started && scannerRef.current !== scanner) {

          try { await scanner.stop(); } catch {}
          try { scanner.clear(); } catch {}
          return;
        }

        if (started && mountedRef.current) {
          setStatus('ready');
          setErrorMessage('');
        }
      } catch (e: any) {
        if (!mountedRef.current) return;
        const raw = e?.message || String(e) || '';
        const isNotAllowed = /not allowed|permission denied|NotAllowedError/i.test(raw);
        const isNotFound = /NotFoundError|no camera|device not found|DevicesNotFoundError|OverconstrainedError/i.test(raw);
        let msg: string;
        let newStatus: Status = 'error';
        if (isNotFound) {
          newStatus = 'no-camera';
          msg = t('noCamera');
        } else if (isNotAllowed) {
          msg = t('permissionDenied');
        } else {
          msg = raw || t('genericError');
        }
        setStatus(newStatus);
        setErrorMessage(msg);
        onError?.(msg);
      }
    };

    run();

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        try { scannerRef.current.stop().catch(() => {}); } catch {}
        try { scannerRef.current.clear(); } catch {}
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, singleMode, attempt]);

  const handleDecode = (decodedText: string, scanner: any) => {
    const result = parseTableIdFromQrContent(decodedText);
    if (result != null) {
      onScan(result);
      if (singleMode) {
        scanner.stop().catch(() => {});
        scannerRef.current = null;
      }
    }
  };

  const handleManualSubmit = () => {
    const v = manualValue.trim();
    if (!v) return;
    const result = parseTableIdFromQrContent(v);
    if (result != null) {
      onScan(result);
      setManualValue('');
    } else {
      setErrorMessage(t('invalidFormat'));
    }
  };

  const handleRetry = () => {
    setStatus('init');
    setErrorMessage('');
    setAttempt(a => a + 1);
  };

  const lanIpHint = currentHostUrl && /localhost|127\.0\.0\.1/i.test(currentHostUrl)
    ? null
    : currentHostUrl;

  return (
    <div className="flex flex-col items-center w-full">

      {!isSecureContext && (
        <div className="w-full max-w-[320px] mb-3 bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs">
          <p className="font-bold text-amber-900">{t('noHttps')}</p>
          <p className="text-amber-700 mt-1">
            {t('noHttpsHint')}
          </p>
          <code className="block mt-1 bg-white border border-amber-200 rounded px-2 py-1 text-amber-800 text-[11px]">
            https://waiter.192-168-1-26.nip.io:8443
          </code>
          <p className="text-amber-600 mt-1 text-[11px]">{t('noHttpsCertHint')}</p>
        </div>
      )}

      <div
        id={containerId}
        className="w-full max-w-[280px] aspect-square overflow-hidden rounded-lg bg-black"
      />

      {(status === 'init' || status === 'requesting') && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          {t('loading')}
        </div>
      )}

      {status === 'ready' && (
        <p className="mt-3 text-sm text-emerald-600 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          {singleMode ? t('ready') : t('readyMulti')}
        </p>
      )}

      {(status === 'error' || status === 'no-camera' || status === 'no-https') && (
        <div className="mt-3 w-full max-w-[320px] bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm font-semibold text-red-800 mb-1">{t('errorTitle')}</p>
          <p className="text-xs text-red-700">{errorMessage}</p>
          {status !== 'no-camera' && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 text-xs px-2.5 py-1 bg-white border border-red-300 rounded hover:bg-red-50 font-medium text-red-700"
            >
              {t('retry')}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 w-full max-w-[320px]">
        <div className="text-center text-xs text-gray-500 mb-2">
          {t('manualSeparator')}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder={t('manualPlaceholder')}
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleManualSubmit(); }}
            className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-base text-center font-bold focus:border-blue-400 focus:outline-none"
            autoFocus={status === 'no-camera' || status === 'no-https'}
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={!manualValue.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40"
          >
            {t('manualGo')}
          </button>
        </div>
      </div>

      {lanIpHint && (status === 'error' || status === 'no-camera') && (
        <details className="mt-3 w-full max-w-[320px] text-[11px] text-gray-500">
          <summary className="cursor-pointer">{t('techInfo')}</summary>
          <p className="mt-1">{t('host')} <code>{currentHostUrl}</code></p>
          <p>{t('secureContext')} <code>{isSecureContext ? t('secureYes') : t('secureNo')}</code></p>
          <p>UA: <code className="break-all">{typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : ''}</code></p>
        </details>
      )}

      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          {t('close')}
        </button>
      )}
    </div>
  );
}
