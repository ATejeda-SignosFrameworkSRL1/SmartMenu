'use client';

import { useEffect, useRef } from 'react';

export function ScreenWakeLock() {
  const lockRef = useRef<any>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
    const nav: any = navigator;
    if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') return;

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

        lock.addEventListener?.('release', () => { lockRef.current = null; });
      } catch {

      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
      else lockRef.current = null;
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
