'use client';

import { useEffect } from 'react';
import { captureException } from '@/lib/sentry';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest, level: 'segment' });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-3">😕</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Algo salió mal</h1>
        <p className="text-gray-600 mb-6">
          No te preocupes, el error fue registrado. Intenta de nuevo o vuelve al inicio.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">Ref: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
          >
            Inicio
          </a>
        </div>
      </div>
    </div>
  );
}
