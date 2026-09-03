'use client';

import { useEffect, useRef } from 'react';

/**
 * Mantiene la pantalla encendida mientras la app del mesero esta visible.
 *
 * POR QUE EXISTE: los avisos (vibracion + notificacion nativa) llegan por
 * SignalR y solo funcionan mientras la app esta VIVA — ver
 * lib/useWaiterNotifications.ts. La alternativa para avisar con la app cerrada
 * es Web Push, que obliga a entidad nueva + migracion + VAPID en el backend y,
 * peor, entrega a traves de los servidores de Google: detras de un portal
 * cautivo puede no llegar nunca. Mantener la app despierta consigue lo mismo
 * sin tocar el backend, y en un reloj dedicado al turno es aceptable.
 *
 * SOLO EN MODO RELOJ por defecto: en un telefono personal dejar la pantalla
 * encendida se come la bateria y ahi el mesero si mira el aparato. Se puede
 * forzar con ?wake=1 y desactivar con ?wake=0 (ambos quedan guardados).
 *
 * El bloqueo se suelta solo cuando la pestaña se oculta —lo exige la API— y se
 * vuelve a pedir al regresar. Si el navegador no lo soporta o lo niega, la app
 * sigue funcionando igual.
 */
export function ScreenWakeLock() {
  const lockRef = useRef<any>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
    const nav: any = navigator;
    if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') return;

    // Decidir si aplica: modo reloj, o forzado por ?wake=1
    let enabled = false;
    try {
      const p = new URLSearchParams(window.location.search);
      const q = p.get('wake');
      if (q === '1') localStorage.setItem('waiter_wake_lock', '1');
      else if (q === '0') localStorage.setItem('waiter_wake_lock', '0');

      const saved = localStorage.getItem('waiter_wake_lock');
      if (saved === '1') enabled = true;
      else if (saved === '0') enabled = false;
      else enabled = document.documentElement.classList.contains('watch-mode');
    } catch {
      enabled = document.documentElement.classList.contains('watch-mode');
    }
    if (!enabled) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (lockRef.current) return;
      try {
        const lock = await nav.wakeLock.request('screen');
        if (cancelled) { try { await lock.release(); } catch {} return; }
        lockRef.current = lock;
        // El navegador puede soltarlo por su cuenta (bateria baja, etc.).
        lock.addEventListener?.('release', () => { lockRef.current = null; });
      } catch {
        /* no soportado, denegado o pestaña oculta: no es critico */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
      else lockRef.current = null; // el navegador ya lo libera al ocultarse
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const lock = lockRef.current;
      lockRef.current = null;
      if (lock) { try { lock.release(); } catch {} }
    };
  }, []);

  return null;
}
