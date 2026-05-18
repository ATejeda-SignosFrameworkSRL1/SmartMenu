'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const APP_KEY = 'kds';
const APP_TITLE = 'Kitchen Display System';
const ACCEPTED_ROLES = ['Chef', 'KitchenStaff', 'Bartender'];
const ACCENT = 'from-orange-600 to-amber-600';

interface QuickUser { email: string; password: string; label: string; emoji: string; hint: string; }
const QUICK_USERS: QuickUser[] = [
  { email: 'chef@smartmenu.com',       password: 'Chef123!',   label: 'Chef',      emoji: '👨‍🍳', hint: 'OK' },
  { email: 'bartender@smartmenu.com',  password: 'Bar123!',    label: 'Bartender', emoji: '🍹',   hint: 'OK' },
  { email: 'admin@smartmenu.com',      password: 'Admin123!',  label: 'Admin',     emoji: '👨‍💼', hint: 'OK' },
  { email: 'waiter@smartmenu.com',     password: 'Waiter123!', label: 'Mesero',    emoji: '👔',   hint: 'denegado' },
];

const ROLE_LABEL: Record<string, string> = {
  Admin: 'Administrador', Manager: 'Gerente', Chef: 'Chef', KitchenStaff: 'Cocina',
  Bartender: 'Bar', Waiter: 'Mesero', Host: 'Host', Hostess: 'Hostess', Cashier: 'Cajero',
};

export default function LoginPage() {
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
      const { accessToken, user } = await res.json();
      const role = user?.role ?? '';
      const allowed = role === 'Admin' || ACCEPTED_ROLES.includes(role);
      if (!allowed) {
        const label = ROLE_LABEL[role] || role || 'desconocido';
        setError(`Tu rol (${label}) no tiene acceso a este módulo.`);
        setLoading(false);
        return;
      }
      localStorage.setItem(`${APP_KEY}_token`, accessToken);
      localStorage.setItem(`${APP_KEY}_user`, JSON.stringify(user));
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-orange-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🍳</div>
          <h1 className="text-3xl font-bold text-white">SmartMenu</h1>
          <p className="text-gray-300 mt-1">{APP_TITLE}</p>
        </div>
        <form onSubmit={onSubmit} className="bg-gray-800 rounded-2xl shadow-xl p-8 space-y-4 border border-gray-700">
          <h2 className="text-2xl font-bold text-white">Iniciar Sesión</h2>
          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 p-3 text-sm text-red-200">{error}</div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Correo electrónico</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              placeholder="chef@smartmenu.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className={`w-full bg-gradient-to-r ${ACCENT} hover:opacity-95 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all`}>
            {loading ? 'Iniciando…' : 'Iniciar sesión'}
          </button>
          <p className="text-xs text-gray-500 text-center">
            Roles permitidos: {ACCEPTED_ROLES.join(', ')} (+ Admin)
          </p>

          <div className="pt-4 mt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 text-center mb-2 font-medium">⚡ Acceso rápido (test)</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_USERS.map((u) => (
                <button key={u.email} type="button" disabled={loading} onClick={() => quickLogin(u)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50
                    ${u.hint === 'OK'
                      ? 'border-orange-600 bg-orange-900/40 hover:bg-orange-900/60 text-orange-200'
                      : 'border-gray-700 bg-gray-900/40 hover:bg-gray-900/60 text-gray-300'}`}>
                  <span className="text-lg">{u.emoji}</span>
                  <span>{u.label}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
