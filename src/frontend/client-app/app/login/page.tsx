'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, Mail, Lock, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const _router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login(email, password);
      console.log('Login response:', response.data); // Debug
      
      const { accessToken, user } = response.data;

      // Guardar token
      localStorage.setItem('admin_token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));

      const fullName = `${user.firstName} ${user.lastName}`;
      toast.success(`¡Bienvenido ${fullName}!`);

      // Esperar para que localStorage se guarde completamente
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Redirigir según el rol (mismo protocolo que la página: HTTPS en cel, HTTP en localhost)
      const role = user.role.toLowerCase();
      const host = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}` : 'https://10.0.0.24';

      let redirectUrl = '';
      if (role === 'admin' || role === 'manager') {
        redirectUrl = `${host}:3001`;
      } else if (role === 'chef' || role === 'kitchenstaff' || role === 'bartender') {
        redirectUrl = `${host}:3002`;
      } else if (role === 'waiter') {
        redirectUrl = `${host}:3003`;
      } else if (role === 'host' || role === 'hostess') {
        redirectUrl = `${host}:3004`;
      } else if (role === 'cashier') {
        redirectUrl = `${host}:3005`;
      } else {
        setError('Rol de usuario no reconocido: ' + user.role);
        toast.error('Rol de usuario no reconocido: ' + user.role);
        return;
      }

      console.log('Redirigiendo a:', redirectUrl); // Debug
      
      // Pasar token y usuario en la URL para que cada app lo guarde en su localStorage
      const userData = encodeURIComponent(JSON.stringify(user));
      const urlWithAuth = `${redirectUrl}?token=${accessToken}&user=${userData}`;
      
      window.location.href = urlWithAuth;
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || 'Credenciales inválidas';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div suppressHydrationWarning className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y Título */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-400 blur-3xl opacity-20 rounded-full"></div>
              <ChefHat className="w-16 h-16 text-primary-600 relative z-10" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SmartMenu</h1>
          <p className="text-gray-600">Portal de Empleados</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Iniciar Sesión</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu-email@smartmenu.com"
                  required
                  suppressHydrationWarning
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  suppressHydrationWarning
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Iniciando sesión...
                </div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Nota: aviso del navegador sobre contraseña */}
          <p className="mt-4 text-xs text-gray-500">
            Si el navegador te dice &quot;cambia tu contraseña, encontrada en una brecha&quot;, es una comprobación <strong>del navegador</strong> (Chrome/Edge), no de SmartMenu. En entorno local puedes ignorarlo o usar otra contraseña de prueba.
          </p>

          {/* Usuarios de prueba */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3 font-medium">Usuarios de Prueba:</p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>👨‍💼 Admin:</span>
                <span className="font-mono">admin@smartmenu.com / Admin123!</span>
              </div>
              <div className="flex justify-between">
                <span>👨‍🍳 Chef:</span>
                <span className="font-mono">chef@smartmenu.com / Chef123!</span>
              </div>
              <div className="flex justify-between">
                <span>🍹 Bar:</span>
                <span className="font-mono">bar@smartmenu.com / Bar123!</span>
              </div>
              <div className="flex justify-between">
                <span>👔 Mesero:</span>
                <span className="font-mono">waiter@smartmenu.com / Waiter123!</span>
              </div>
              <div className="flex justify-between">
                <span>🚪 Host:</span>
                <span className="font-mono">host@smartmenu.com / Host123!</span>
              </div>
              <div className="flex justify-between">
                <span>💰 Cajero:</span>
                <span className="font-mono">cashier@smartmenu.com / Cash123!</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-gray-500">
            ¿Eres cliente? Escanea el QR de tu mesa para ordenar.
          </p>
          <p className="text-xs text-gray-500">
            Desde el celular (cámara): abre con <strong>https://</strong> (ej. <strong>https://</strong>10.0.0.24:3000). En la PC: API con <code className="bg-gray-100 px-1 rounded">dotnet run</code>, client y waiter con <code className="bg-gray-100 px-1 rounded">npm run dev:https</code>. Acepta el certificado en el navegador si lo pide.
          </p>
        </div>
      </div>
    </div>
  );
}
