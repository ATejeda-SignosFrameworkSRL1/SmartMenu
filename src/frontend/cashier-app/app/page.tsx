'use client';

import { useEffect, useState } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import axios from 'axios';

const api = axios.create({
  baseURL: '',
});

function CashierView({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [summary, setSummary] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const loadPayments = async () => {
    setLoading(true);
    try {
      const from = new Date(date);
      const to = new Date(date);
      to.setDate(to.getDate() + 1);
      const res = await api.get('/api/payment/list', { params: { from: from.toISOString(), to: to.toISOString() } });
      setSummary(res.data?.summary ?? { totalAmount: 0, totalTips: 0, count: 0 });
      setPayments(Array.isArray(res.data?.payments) ? res.data.payments : []);
    } catch (e) {
      setSummary({ totalAmount: 0, totalTips: 0, count: 0 });
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('cashier_token');
    if (!token) return;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadPayments();
  }, [date]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
              <p className="text-sm text-gray-600">Cajero: {user?.firstName ?? user?.name} {user?.lastName ?? ''}</p>
            </div>
            <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 items-center mb-6">
          <input type="date" value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} className="border rounded-lg px-4 py-2" />
          <button onClick={loadPayments} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <RefreshCw className="w-5 h-5" /> Actualizar
          </button>
        </div>
        {loading ? (
          <p className="text-gray-600">Cargando...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow p-6 border-2 border-green-200">
                <p className="text-sm text-gray-600">Ventas del día</p>
                <p className="text-2xl font-bold text-green-700">RD$ {Number(summary?.totalAmount ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-6 border-2 border-blue-200">
                <p className="text-sm text-gray-600">Propinas</p>
                <p className="text-2xl font-bold text-blue-700">RD$ {Number(summary?.totalTips ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-6 border-2 border-gray-200">
                <p className="text-sm text-gray-600">Transacciones</p>
                <p className="text-2xl font-bold text-gray-800">{summary?.count ?? 0}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <h2 className="text-lg font-bold p-4 border-b">Movimientos del día</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-3 font-semibold">Hora</th>
                      <th className="text-left p-3 font-semibold">Orden</th>
                      <th className="text-left p-3 font-semibold">Mesa</th>
                      <th className="text-left p-3 font-semibold">Método</th>
                      <th className="text-right p-3 font-semibold">Monto</th>
                      <th className="text-right p-3 font-semibold">Propina</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">{p.completedAt ? new Date(p.completedAt).toLocaleTimeString('es-DO') : '-'}</td>
                        <td className="p-3 font-mono">{p.orderNumber ?? '-'}</td>
                        <td className="p-3">{p.tableNumber ?? '-'}</td>
                        <td className="p-3">{p.method ?? '-'}</td>
                        <td className="p-3 text-right font-medium">RD$ {Number(p.amount ?? 0).toFixed(2)}</td>
                        <td className="p-3 text-right text-blue-600">RD$ {Number(p.tipAmount ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {payments.length === 0 && <p className="p-6 text-gray-500 text-center">No hay pagos en esta fecha.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CashierApp() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');

    if (tokenFromUrl && userFromUrl) {
      localStorage.setItem('cashier_token', tokenFromUrl);
      localStorage.setItem('cashier_user', decodeURIComponent(userFromUrl));
      window.history.replaceState({}, '', window.location.pathname);
    }

    const userData = localStorage.getItem('cashier_user');
    const token = localStorage.getItem('cashier_token');

    if (!userData || !token) {
      window.location.href = 'https://172.31.98.64:3000/login';
      return;
    }

    setUser(JSON.parse(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('cashier_token');
    localStorage.removeItem('cashier_user');
    window.location.href = 'https://172.31.98.64:3000/login';
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return <CashierView user={user} onLogout={handleLogout} />;
}
