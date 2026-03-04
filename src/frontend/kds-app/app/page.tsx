'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import * as signalR from '@microsoft/signalr';

const api = axios.create({
  baseURL: '',
});

const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  return DRINK_KEYWORDS.some((k) => name.includes(k));
}

const wsBaseUrl = '';

interface OrderItem {
  id: number;
  dishName: string;
  quantity: number;
  notes?: string;
  customizations?: string;
  allergies?: string;
  sideDish?: string;
  meatCooking?: string;
  status?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  tableId: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function KDSPage() {
  const [user, setUser] = useState<any>(null);
  const userRef = useRef<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');

    if (tokenFromUrl && userFromUrl) {
      sessionStorage.setItem('kds_token', tokenFromUrl);
      sessionStorage.setItem('kds_user', decodeURIComponent(userFromUrl));
      window.history.replaceState({}, '', '/');
    }

    const userData = sessionStorage.getItem('kds_user');
    const token = sessionStorage.getItem('kds_token');

    if (!userData || !token) {
      window.location.href = 'https://172.31.98.64:3000/login';
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    userRef.current = parsedUser;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Refresh user profile from server to get latest assignedZoneId
    const userId = parsedUser.id ?? parsedUser.Id;
    if (userId) {
      api.get(`/api/user/${userId}`).then(res => {
        if (res.data) {
          const fresh = {
            ...parsedUser,
            assignedZoneId: res.data.assignedZoneId ?? res.data.AssignedZoneId,
            assignedZoneName: res.data.assignedZoneName ?? res.data.AssignedZoneName,
          };
          setUser(fresh);
          userRef.current = fresh;
          sessionStorage.setItem('kds_user', JSON.stringify(fresh));
          loadOrders();
        }
      }).catch(() => {});
    }

    loadOrders();
    setLoading(false);

    // SignalR: escuchar nuevas órdenes para cocina (cuando el mesero confirma la orden)
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${wsBaseUrl}/hubs/kitchen`, { accessTokenFactory: () => Promise.resolve(token) })
      .withAutomaticReconnect()
      .build();

    connection.on('NewKitchenOrder', () => {
      loadOrders();
      toast.success('Nueva orden para cocina');
    });

    connection.start().catch((err) => console.warn('SignalR kitchen:', err));

    const interval = setInterval(loadOrders, 5000);
    return () => {
      clearInterval(interval);
      connection.stop().catch(() => {});
    };
  }, []);

  const loadOrders = async () => {
    try {
      const token = sessionStorage.getItem('kds_token');
      if (!token) return;
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await api.get('/api/order/active');
      const data = response?.data;
      if (!Array.isArray(data)) {
        setOrders([]);
        return;
      }
      // Solo órdenes ya confirmadas por el mesero (Confirmed) o en preparación/listas. Pending = no confirmada, no va a cocina.
      const activeOrders = data.filter((order: Order & { status?: string | number }) => {
        const s = order.status;
        if (typeof s === 'number') return s >= 1 && s <= 3; // Confirmed=1, Preparing=2, Ready=3
        return ['Confirmed', 'Preparing', 'Ready'].includes(String(s));
      });

      // Filtrar por zona del chef: solo items que pertenecen a mi cocina/bar
      const currentUser = userRef.current;
      const chefZoneId = currentUser ? (currentUser.assignedZoneId ?? currentUser.AssignedZoneId ?? null) : null;

      const kitchenOrders = activeOrders
        .map((order: Order) => {
          const items = order.items || [];
          const myItems = chefZoneId
            ? items.filter((item: any) => {
                const itemZone = item.kitchenZoneId ?? item.KitchenZoneId;
                return itemZone === chefZoneId;
              })
            : items.filter((item: any) => !isDrinkItem(item.dishName ?? item.DishName ?? ''));
          return { ...order, items: myItems };
        })
        .filter((order: Order) => order.items.length > 0);

      kitchenOrders.sort((a: Order, b: Order) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setOrders(kitchenOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    }
  };

  const getTimeElapsed = (createdAt: string) => {
    const minutes = Math.floor(
      (new Date().getTime() - new Date(createdAt).getTime()) / 60000
    );
    return minutes;
  };

  const getAlertColor = (minutes: number) => {
    if (minutes < 15) return 'bg-green-500';
    if (minutes < 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // El chef no confirma: eso lo hace el mesero en Waiter App. Cocina solo marca Preparando y Listo.
  const handleKitchenPreparing = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/kitchen-preparing`);
      toast.success('Marcado como Preparando');
      loadOrders();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleKitchenReady = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/kitchen-ready`);
      toast.success('Marcado como Listo para servir');
      loadOrders();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Kitchen Display System</h1>
              <p className="text-gray-400 text-sm mt-1">
                {user?.firstName} {user?.lastName}
                {(user?.assignedZoneName ?? user?.AssignedZoneName) && (
                  <span className="ml-2 text-primary-400">— {user.assignedZoneName ?? user.AssignedZoneName}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-400">{orders.length}</p>
                <p className="text-sm text-gray-400">Órdenes Activas</p>
              </div>
              <button
                onClick={() => {
                  sessionStorage.clear();
                  window.location.href = 'https://172.31.98.64:3000/login';
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <Check className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <p className="text-2xl text-gray-400">¡Todo listo! No hay órdenes pendientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              const elapsed = getTimeElapsed(order.createdAt);
              const alertColor = getAlertColor(elapsed);
              const items = order.items || [];
              const allAllergies = items
                .map((i: any) => (i.allergies ?? i.Allergies ?? '').trim())
                .filter(Boolean);
              const hasAllergies = allAllergies.length > 0;
              const allergiesText = [...new Set(allAllergies)].join(', ').toUpperCase() || null;

              return (
                <div
                  key={order.id}
                  className="bg-gray-800 rounded-lg border-2 border-gray-700 overflow-hidden hover:border-primary-600 transition-colors"
                >
                  {/* Header: Mesa + ALERGIA badge + tiempo */}
                  <div className={`${alertColor} p-4`}>
                    <div className="flex flex-wrap justify-between items-center gap-2 text-white">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-2xl font-bold">Mesa {order.tableId ?? (order as any).tableNumber ?? '-'}</p>
{/*                         {hasAllergies && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-600 text-white text-sm font-bold">
                            <AlertCircle className="w-4 h-4" />
                            ALERGIA
                          </span>
                        )} */}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span className="text-xl font-bold">{elapsed} min</span>
                      </div>
                    </div>
                    <p className="text-sm opacity-90 mt-1">Orden #{order.orderNumber}</p>
                  </div>

                  {/* Bloque de alergias destacado */}
                  {hasAllergies && allergiesText && (
                    <div className="mx-4 mt-3 rounded-lg bg-red-900/40 border border-red-500 p-3 flex items-center gap-2">
                      <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                      <span className="text-red-200 font-semibold uppercase">ALERGIA: {allergiesText}</span>
                    </div>
                  )}

                  {/* Items con preferencias por plato */}
                  <div className="p-4 space-y-3">
                    {items.map((item: any, idx: number) => (
                      <div key={item.id ?? idx} className="rounded-lg bg-amber-900/20 border border-amber-600/40 p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-amber-400">{item.quantity}x</span>
                            <span className="ml-2 text-lg text-white">{item.dishName ?? item.DishName}</span>
                          </div>
                        </div>
                        {(() => {
                          const notes = item.notes ?? item.Notes ?? '';
                          const preference = item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking ?? '';
                          const sideDish = item.sideDish ?? item.SideDish ?? '';
                          const customizations = item.customizations ?? item.Customizations ?? '';
                          const allergies = item.allergies ?? item.Allergies ?? '';
                          const hasAny = notes || preference || sideDish || customizations || allergies;
                          if (!hasAny) return null;
                          return (
                            <div className="mt-2 ml-4 space-y-1 text-sm">
                              {notes ? (
                                <div className="text-yellow-200 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  {notes}
                                </div>
                              ) : null}
                              {preference ? (
                                <div className="text-orange-300">🔥 Preferencia / Término: {preference}</div>
                              ) : null}
                              {sideDish ? (
                                <div className="text-amber-200">🍽️ Guarnición: {sideDish}</div>
                              ) : null}
                              {customizations ? (
                                <div className="text-amber-200">🍴 Personalización: {customizations}</div>
                              ) : null}
{/*                               {allergies ? (
                                <div className="text-red-400 font-medium">⚠ Alergia: {allergies}</div>
                              ) : null} */}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  {/* Actions: cocina solo marca Preparando y Listo. La confirmación la hace el mesero en Waiter App. */}
                  <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                    {(order.status === 'Confirmed' || String(order.status) === '1') && (
                      <button
                        onClick={() => handleKitchenPreparing(order.id)}
                        className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition-colors"
                      >
                        👨‍🍳 Preparando
                      </button>
                    )}
                    
                    {(order.status === 'Preparing' || String(order.status) === '2') && (
                      <button
                        onClick={() => handleKitchenReady(order.id)}
                        className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                      >
                        ✅ Listo para Servir
                      </button>
                    )}
                    
                    {(order.status === 'Ready' || String(order.status) === '3') && (
                      <div className="text-center py-2 text-green-400 font-medium">
                        ✓ Listo — esperando que el mesero sirva
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
