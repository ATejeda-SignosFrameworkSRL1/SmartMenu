'use client';

/**
 * LoginScreen parametrizable — reemplaza los ~126 LOC duplicados en cada uno
 * de los 6 login/page.tsx (admin, kds, waiter, host, cashier, reservation).
 *
 * Uso:
 *   export default function Page() {
 *     return (
 *       <LoginScreen
 *         appKey="admin"
 *         appTitle="Panel de Administración"
 *         acceptedRoles={['Admin', 'Manager']}
 *         accent="from-blue-600 to-indigo-600"
 *         quickUsers={[
 *           { email: 'admin@smartmenu.com', password: 'Admin123!', label: 'Admin', emoji: '👨‍💼', hint: 'OK' },
 *           ...
 *         ]}
 *       />
 *     );
 *   }
 *
 * Convención: hint='OK' marca quick-users con rol permitido (estilo verde),
 * el resto se renderiza en gris para que el QA vea claramente cuáles serán
 * rechazados por role validation.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface QuickUser {
  email: string;
  password: string;
  label: string;
  emoji: string;
  hint?: 'OK' | string;
}

export interface LoginScreenProps {
  appKey: string;
  appTitle: string;
  acceptedRoles: string[];
  /** Tailwind gradient classes, ej. 'from-blue-600 to-indigo-600' */
  accent?: string;
  quickUsers?: QuickUser[];
  /** Path al cual redirigir tras login OK. Default '/'. */
  homePath?: string;
}

const ROLE_LABEL: Record<string, string> = {
  Admin: 'Administrador',
  Manager: 'Gerente',
  Chef: 'Chef',
  KitchenStaff: 'Cocina',
  Bartender: 'Bar',
  Waiter: 'Mesero',
  Host: 'Host',
  Hostess: 'Hostess',
  Cashier: 'Cajero',
  Delivery: 'Repartidor',
};

export function LoginScreen({
  appKey,
  appTitle,
  acceptedRoles,
  accent = 'from-blue-600 to-indigo-600',
  quickUsers,
  homePath = '/',
}: LoginScreenProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doLogin = async (em: string, pw: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password: pw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Credenciales inválidas');
      }
      const { accessToken, refreshToken, user } = await res.json();
      const role = user?.role ?? '';
      const allowed = role === 'Admin' || acceptedRoles.includes(role);
      if (!allowed) {
        const label = ROLE_LABEL[role] || role || 'desconocido';
        setError(`Tu rol (${label}) no tiene acceso a este módulo.`);
        setLoading(false);
        return;
      }
      localStorage.setItem(`${appKey}_token`, accessToken);
      if (refreshToken) localStorage.setItem(`${appKey}_refresh`, refreshToken);
      localStorage.setItem(`${appKey}_user`, JSON.stringify(user));
      router.replace(homePath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(msg);
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  const quickLogin = (u: QuickUser) => {
    setEmail(u.email);
    setPassword(u.password);
    doLogin(u.email, u.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">SmartMenu</h1>
          <p className="text-gray-600 mt-1">{appTitle}</p>
        </div>
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-4 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Iniciar Sesión</h2>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="tu-email@smartmenu.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-gradient-to-r ${accent} hover:opacity-95 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all`}
          >
            {loading ? 'Iniciando…' : 'Iniciar sesión'}
          </button>
          <p className="text-xs text-gray-500 text-center">
            Roles permitidos: {acceptedRoles.join(', ')} (+ Admin)
          </p>

          {quickUsers && quickUsers.length > 0 && (
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center mb-2 font-medium">⚡ Acceso rápido (test)</p>
              <div className="grid grid-cols-2 gap-2">
                {quickUsers.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    disabled={loading}
                    onClick={() => quickLogin(u)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50
                      ${u.hint === 'OK'
                        ? 'border-green-200 bg-green-50 hover:bg-green-100 text-green-800'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}
                  >
                    <span className="text-lg" aria-hidden="true">{u.emoji}</span>
                    <span>{u.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;
