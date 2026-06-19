'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';

interface InactivityGuardProps {
  /**
   * Segundos sin actividad antes de cerrar sesión.
   * Default: 90s (recomendado para PIN auth en device compartido).
   */
  timeoutSeconds?: number;
  /**
   * Solo aplicar este guard cuando el JWT tiene claim "auth_method=pin".
   * Default true. Si false, aplica a CUALQUIER sesión.
   */
  onlyForPinAuth?: boolean;
  /** Para qué app — usa para construir la URL de redirect. Default '/login/pin'. */
  loginPath?: string;
  /** Keys de localStorage a limpiar al expirar. */
  storageKeys?: string[];
  /** Mostrar warning N segundos antes (countdown). Default 15s. */
  warningSeconds?: number;
}

function decodeJwtAuthMethod(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return payload?.auth_method ?? null;
  } catch {
    return null;
  }
}

/**
 * Sprint 4.1 — Auto-logout por inactividad.
 *
 * Pensado para devices compartidos donde un waiter ingresa con PIN, hace su
 * acción, y se aleja: la sesión debe cerrarse sola para que otro waiter no
 * actúe accidentalmente con la identidad anterior.
 *
 * Detecta: mousedown, keydown, touchstart, scroll, click.
 * Muestra warning visual N seg antes de expirar (countdown amber).
 * Al expirar: limpia storage, redirige a /login/pin con flag de motivo.
 *
 * Solo se activa si la sesión vino de PIN (claim auth_method=pin en el JWT).
 * Login normal email/password NO es afectado por este guard.
 */
export function InactivityGuard({
  timeoutSeconds = 90,
  onlyForPinAuth = true,
  loginPath = '/login/pin',
  storageKeys = ['waiter_token', 'waiter_user', 'waiter_refresh'],
  warningSeconds = 15,
}: InactivityGuardProps) {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [active, setActive] = useState(false);

  // Decide si el guard debe activarse (basado en JWT)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('waiter_token') : null;
    if (!token) {
      setActive(false);
      return;
    }
    if (onlyForPinAuth) {
      const method = decodeJwtAuthMethod(token);
      setActive(method === 'pin');
    } else {
      setActive(true);
    }
  }, [onlyForPinAuth]);

  // Listeners de actividad + tick timer
  useEffect(() => {
    if (!active) return;

    const reset = () => {
      lastActivityRef.current = Date.now();
      setSecondsLeft(null); // ocultar warning si había
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));

    // Tick cada segundo: verifica si expiró o si entró en warning window
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000;
      const remaining = Math.ceil(timeoutSeconds - elapsed);

      if (remaining <= 0) {
        // EXPIRADO — clear storage y redirige
        storageKeys.forEach(k => localStorage.removeItem(k));
        if (timerRef.current) window.clearInterval(timerRef.current);
        // pasar query param para que /login/pin muestre el motivo
        router.replace(`${loginPath}?reason=inactivity`);
        return;
      }

      if (remaining <= warningSeconds) {
        setSecondsLeft(remaining);
      }
    }, 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [active, timeoutSeconds, warningSeconds, loginPath, router, storageKeys]);

  // Render: solo el warning visual (countdown amber) en los últimos N segs
  if (!active || secondsLeft === null) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 animate-pulse">
      <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
      <div className="text-sm">
        <p className="font-bold text-amber-900">Sesión a punto de expirar</p>
        <p className="text-xs text-amber-700">
          Toca cualquier parte para mantenerla activa · cierra en{' '}
          <span className="font-bold tabular-nums">{secondsLeft}s</span>
        </p>
      </div>
    </div>
  );
}
