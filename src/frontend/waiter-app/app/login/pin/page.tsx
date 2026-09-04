'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PinPad } from '@/app/components/PinPad';
import { ArrowLeft, Lock, Clock } from 'lucide-react';

export default function PinLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Cargando…</div>}>
      <PinLoginInner />
    </Suspense>
  );
}

function PinLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinPadKey, setPinPadKey] = useState(0);
  const [showInactivityBanner, setShowInactivityBanner] = useState(false);

  useEffect(() => {
    if (searchParams?.get('reason') === 'inactivity') {
      setShowInactivityBanner(true);

      const t = setTimeout(() => setShowInactivityBanner(false), 8000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  const handleSubmit = async (pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/pin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error || (res.status === 401
          ? 'PIN incorrecto'
          : `Error ${res.status}`);
        setError(msg);
        setPinPadKey(k => k + 1);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!data.accessToken) {
        setError('Respuesta inválida del servidor');
        setPinPadKey(k => k + 1);
        setLoading(false);
        return;
      }

      const role = (data.user?.role || '').toLowerCase();
      if (role !== 'waiter') {
        setError('Este PIN no corresponde a un waiter de este restaurante');
        setPinPadKey(k => k + 1);
        setLoading(false);
        return;
      }

      localStorage.setItem('waiter_token', data.accessToken);
      localStorage.setItem('waiter_user', JSON.stringify(data.user));

      localStorage.setItem('waiter_refresh', '');
      router.push('/');
    } catch (e: any) {
      setError(e?.message || 'Error de red');
      setPinPadKey(k => k + 1);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 sm:p-8 space-y-6">

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Acceso por PIN</h1>
          <p className="text-sm text-gray-500">
            Device compartido del salón — ingresa tu PIN de 6 dígitos
          </p>
        </div>

        {showInactivityBanner && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Sesión cerrada por inactividad</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Por seguridad cerramos tu sesión. Ingresa tu PIN para continuar.
              </p>
            </div>
          </div>
        )}

        <PinPad
          key={pinPadKey}
          length={6}
          onSubmit={handleSubmit}
          prompt={loading ? 'Verificando...' : 'Ingresa tu PIN'}
          error={error}
          loading={loading}
        />

        <div className="pt-4 border-t border-gray-100 flex flex-col gap-3 text-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Usar email y contraseña
          </a>
          <p className="text-[11px] text-gray-400">
            ¿No tienes PIN configurado? Pídele al administrador que te lo asigne.
          </p>
        </div>
      </div>
    </div>
  );
}
