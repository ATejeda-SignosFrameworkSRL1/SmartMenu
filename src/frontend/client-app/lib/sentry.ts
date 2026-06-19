/**
 * Error/log abstraction — placeholder hoy, listo para swap a Sentry mañana.
 *
 * Hoy:
 *   - Sin DSN configurado → console.error/warn (devs lo ven local)
 *   - Listo para que error.tsx / global-error.tsx llamen captureException
 *
 * Para activar Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Crear proyecto en https://sentry.io y copiar el DSN
 *   3. .env.local:
 *        NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
 *        NEXT_PUBLIC_SENTRY_ENV=production
 *   4. Reemplazar las funciones de abajo (captureException, captureMessage,
 *      setUserContext, initSentry) por:
 *        import * as Sentry from '@sentry/nextjs';
 *        Sentry.init({ dsn: DSN, environment: ENV, tracesSampleRate: 0.1, ... });
 *        export const captureException = Sentry.captureException;
 *        // etc.
 *   5. Rebuild + redeploy.
 *
 * Esta abstracción mantiene los call-sites estables: error.tsx no cambia
 * cuando se active Sentry — solo cambia el cuerpo de esta lib.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
const ENV = process.env.NEXT_PUBLIC_SENTRY_ENV ?? (process.env.NODE_ENV ?? 'development');

export async function initSentry(_appName: string): Promise<void> {
  // No-op hoy. Cuando se active Sentry, mover Sentry.init aquí.
  // Para evitar tree-shake del config, no hacemos return temprano sin DSN.
  if (!DSN) return;
  if (typeof console !== 'undefined') {
    console.info(`[sentry] DSN configurado (env=${ENV}) pero @sentry/nextjs no está instalado; ver lib/sentry.ts para upgrade`);
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (typeof console !== 'undefined') {
    console.error('[captureException]', error, context ?? '');
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  if (typeof console !== 'undefined') {
    console.warn('[captureMessage]', message, context ?? '');
  }
}

export function setUserContext(_user: { id?: string; email?: string } | null): void {
  // No-op hoy. Cuando se active Sentry, llamar Sentry.setUser aquí.
}
