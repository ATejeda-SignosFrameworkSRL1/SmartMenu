
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
const ENV = process.env.NEXT_PUBLIC_SENTRY_ENV ?? (process.env.NODE_ENV ?? 'development');

export async function initSentry(_appName: string): Promise<void> {

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

}
