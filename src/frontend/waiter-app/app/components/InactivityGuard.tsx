'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface InactivityGuardProps {

  timeoutSeconds?: number;

  onlyForPinAuth?: boolean;

  loginPath?: string;

  storageKeys?: string[];

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

export function InactivityGuard({
  timeoutSeconds = 90,
  onlyForPinAuth = true,
  loginPath = '/login/pin',
  storageKeys = ['waiter_token', 'waiter_user', 'waiter_refresh'],
  warningSeconds = 15,
}: InactivityGuardProps) {
  const router = useRouter();
  const t = useTranslations('inactivity');
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [active, setActive] = useState(false);

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

  useEffect(() => {
    if (!active) return;

    const reset = () => {
      lastActivityRef.current = Date.now();
      setSecondsLeft(null);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));

    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000;
      const remaining = Math.ceil(timeoutSeconds - elapsed);

      if (remaining <= 0) {

        storageKeys.forEach(k => localStorage.removeItem(k));
        if (timerRef.current) window.clearInterval(timerRef.current);

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

  if (!active || secondsLeft === null) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 animate-pulse">
      <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
      <div className="text-sm">
        <p className="font-bold text-amber-900">{t('warningTitle')}</p>
        <p className="text-xs text-amber-700">
          {t('warningHint', { seconds: secondsLeft })}
        </p>
      </div>
    </div>
  );
}
