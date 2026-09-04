'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { KeyRound, Trash2, X, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface PinManagerModalProps {

  user: {
    id: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    hasPin?: boolean;
    pinSetAt?: string | null;
  };
  onClose: () => void;

  onUpdated?: () => void;
}

const api = axios.create({ baseURL: '' });

export function PinManagerModal({ user, onClose, onUpdated }: PinManagerModalProps) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'change'>(user.hasPin ? 'change' : 'create');

  const userName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || `User #${user.id}`;

  const validatePinClient = (p: string): string | null => {
    if (!/^[0-9]{6}$/.test(p)) return 'El PIN debe ser exactamente 6 dígitos numéricos';

    if (/^(\d)\1{5}$/.test(p)) return 'El PIN no puede ser todos los dígitos iguales (111111)';
    if (p === '123456' || p === '654321' || p === '012345' || p === '098765') {
      return 'El PIN no puede ser una secuencia obvia';
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const v = validatePinClient(pin);
    if (v) { setError(v); return; }
    if (pin !== confirm) { setError('La confirmación no coincide'); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await api.put(`/api/user/${user.id}/pin`, { pin });
      toast.success(mode === 'create' ? 'PIN creado correctamente' : 'PIN actualizado');
      onUpdated?.();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Error al guardar PIN';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm) {

    }
    if (!window.confirm(`¿Remover el PIN de ${userName}?\n\nNo podrá ingresar al waiter-app vía numpad hasta que le asignes uno nuevo.`)) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await api.delete(`/api/user/${user.id}/pin`);
      toast.success('PIN removido');
      onUpdated?.();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Error al remover PIN';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>

        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Gestión de PIN</h2>
              <p className="text-xs text-emerald-50">{userName} ({user.role})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {user.hasPin ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-emerald-900">PIN configurado</p>
              {user.pinSetAt && (
                <p className="text-xs text-emerald-700 mt-0.5">
                  Establecido: {new Date(user.pinSetAt).toLocaleString('es-DO', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                  })}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-amber-900">Sin PIN configurado</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Este usuario no puede usar el modo PUBLIC del waiter-app aún.
              </p>
            </div>
          )}

          {(mode === 'create' || mode === 'change') && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {mode === 'create' ? 'PIN (6 dígitos)' : 'Nuevo PIN (6 dígitos)'}
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 pr-10 font-mono text-lg tracking-widest focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Confirmar PIN</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 font-mono text-lg tracking-widest focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <p>• Comparte el PIN solo con {userName}.</p>
                <p>• Evita secuencias obvias (123456) y dígitos repetidos (111111).</p>
                <p>• El PIN será único dentro del restaurante.</p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            {user.hasPin && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleRemove}
                disabled={loading}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Remover PIN
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={loading} className="ml-auto">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || pin.length !== 6 || confirm.length !== 6}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Guardando...' : (mode === 'create' ? 'Crear PIN' : 'Actualizar PIN')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
