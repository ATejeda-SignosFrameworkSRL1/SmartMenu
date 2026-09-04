'use client';

import { useEffect } from 'react';
import { captureException } from '@/lib/sentry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest, level: 'global' });
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0, background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ maxWidth: 480, background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#111827' }}>
            Error inesperado
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            El sistema encontró un problema. Refresca la página o vuelve al inicio.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', marginBottom: '1rem' }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ padding: '0.6rem 1.2rem', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
