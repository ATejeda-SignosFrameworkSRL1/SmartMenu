'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, KeyRound, GitMerge, Check } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Restaurant {
  id: number;
  name: string;
  waiterAuthMode: number;
  waiterAuthModeName: string;
}

const api = axios.create({ baseURL: '' });

const MODES = [
  {
    id: 0,
    key: 'PrivateOnly',
    label: 'Privado (login personal)',
    icon: Shield,
    color: 'blue',
    desc: 'Cada waiter usa su email + contraseña en SU device personal. Sin acceso por PIN.',
    when: 'Operación pequeña (3-5 waiters), devices personales, baja rotación.',
  },
  {
    id: 1,
    key: 'PublicPin',
    label: 'Público (solo PIN)',
    icon: KeyRound,
    color: 'emerald',
    desc: 'Cualquier device compartido (tablet de salón) acepta PIN de 6 dígitos. Sin login email.',
    when: 'Devices compartidos por zona/estación, rotación alta de waiters.',
  },
  {
    id: 2,
    key: 'Hybrid',
    label: 'Híbrido (ambos)',
    icon: GitMerge,
    color: 'purple',
    desc: 'Devices personales con login normal + tablets compartidas con PIN.',
    when: 'Operación mediana/grande con mix de devices personales y compartidos.',
  },
];

export function WaiterAuthModeSelector() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/restaurant/current');
      setRestaurant(res.data);
    } catch (e: any) {
      toast.error('Error al cargar configuración del restaurante');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = async (modeId: number) => {
    if (!restaurant) return;
    if (restaurant.waiterAuthMode === modeId) return;
    if (!window.confirm(`¿Cambiar el modo de autenticación a "${MODES.find(m => m.id === modeId)?.label}"?\n\nEsto afecta cómo todos los waiters acceden al sistema.`)) return;

    setUpdating(modeId);
    try {
      const token = localStorage.getItem('admin_token');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await api.put(`/api/restaurant/${restaurant.id}/auth-mode`, { mode: modeId });
      toast.success(`Modo actualizado: ${MODES.find(m => m.id === modeId)?.label}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al actualizar modo');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Cargando configuración...
        </CardContent>
      </Card>
    );
  }

  if (!restaurant) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-red-600">
          No se pudo cargar la configuración del restaurante.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-gray-700" />
            <h3 className="text-base font-bold">Modo de autenticación de Waiters</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Restaurante: <strong>{restaurant.name}</strong> · Actual:{' '}
            <span className="font-semibold text-emerald-700">{restaurant.waiterAuthModeName}</span>
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map(m => {
            const Icon = m.icon;
            const isActive = restaurant.waiterAuthMode === m.id;
            const isUpdating = updating === m.id;
            const colorClasses = {
              blue: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
              emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
              purple: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100' },
            }[m.color] || { border: 'border-gray-200', bg: 'bg-white', text: 'text-gray-700', iconBg: 'bg-gray-100' };

            return (
              <button
                key={m.id}
                onClick={() => handleChange(m.id)}
                disabled={isActive || isUpdating}
                className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? `${colorClasses.border} ${colorClasses.bg} shadow-md`
                    : 'border-gray-200 bg-white hover:border-gray-400 cursor-pointer'
                }`}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <div className={`w-6 h-6 rounded-full ${colorClasses.border.replace('border-','bg-')} flex items-center justify-center`}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                <div className={`w-9 h-9 rounded-lg ${colorClasses.iconBg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-5 h-5 ${colorClasses.text}`} />
                </div>
                <h4 className="font-bold text-sm text-gray-900 mb-1">{m.label}</h4>
                <p className="text-xs text-gray-600 mb-2 leading-relaxed">{m.desc}</p>
                <div className="text-[11px] text-gray-500 italic border-t border-gray-100 pt-2 mt-2">
                  <strong>Ideal cuando:</strong> {m.when}
                </div>
                {isUpdating && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <strong>Nota:</strong> Cambiar el modo NO desconecta a waiters ya logueados.
          El cambio aplica a nuevas sesiones. Los PINs configurados se mantienen aunque cambies a PrivateOnly
          (no se borran — sólo dejan de ser usables).
        </div>
      </CardContent>
    </Card>
  );
}
