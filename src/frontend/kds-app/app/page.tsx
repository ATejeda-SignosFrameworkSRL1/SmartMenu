'use client';

import { useEffect, useState, useRef } from 'react';
import { Clock, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import * as signalR from '@microsoft/signalr';
import { createAuthApi } from '@/lib/auth-client';

// F3 — auth-client centralizado reemplaza el interceptor JWT inline.
const { api } = createAuthApi('kds');

const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  return DRINK_KEYWORDS.some((k) => name.includes(k));
}

// Mapa de DrinkTiming (0=Before/1=During/2=After) → CourseTiming string
const DRINK_TIMING_TO_COURSE: Record<number, string> = {
  0: 'Entrada',
  1: 'PlatoFuerte',
  2: 'Postre',
};

const COURSE_META: Record<string, { label: string; icon: string; order: number; color: string; badge: string }> = {
  Entrada:     { label: 'Entrada',      icon: '🥗', order: 0, color: 'border-green-500',  badge: 'bg-green-800/60 text-green-200' },
  PlatoFuerte: { label: 'Plato Fuerte', icon: '🍖', order: 1, color: 'border-orange-500', badge: 'bg-orange-800/60 text-orange-200' },
  Postre:      { label: 'Postre',       icon: '🍰', order: 2, color: 'border-pink-500',   badge: 'bg-pink-800/60 text-pink-200' },
};

const DRINK_TIMING_META: Record<string, { label: string; icon: string; badge: string }> = {
  Before: { label: 'Con la Entrada',      icon: '🥂', badge: 'bg-blue-800/60 text-blue-200' },
  During: { label: 'Con el Plato Fuerte', icon: '🍷', badge: 'bg-purple-800/60 text-purple-200' },
  After:  { label: 'Con el Postre',       icon: '🍸', badge: 'bg-amber-800/60 text-amber-200' },
};

function resolveItemCourse(item: any): string {
  const ct = item.courseTiming ?? item.CourseTiming;
  if (ct) return ct;
  const dt = item.drinkTiming ?? item.DrinkTiming;
  if (dt !== undefined && dt !== null) {
    const dtNum = typeof dt === 'string'
      ? ['Before','During','After'].indexOf(dt)
      : dt;
    return DRINK_TIMING_TO_COURSE[dtNum] ?? 'PlatoFuerte';
  }
  return 'PlatoFuerte';
}

function resolveDrinkTiming(item: any): string {
  const dt = item.drinkTiming ?? item.DrinkTiming;
  if (dt === undefined || dt === null) return 'During';
  if (typeof dt === 'string' && ['Before', 'During', 'After'].includes(dt)) return dt;
  return ['Before', 'During', 'After'][Number(dt)] ?? 'During';
}

type CourseFilter = 'all' | 'Entrada' | 'PlatoFuerte' | 'Postre';
type DrinkTimingFilter = 'all' | 'Before' | 'During' | 'After';

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
  tableNumber?: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  kitchenPreparing?: boolean;
  kitchenReady?: boolean;
  kitchenServed?: boolean;
  barPreparing?: boolean;
  barReady?: boolean;
  barServed?: boolean;
}

function isBarUser(u: any): boolean {
  const role = (u?.role ?? u?.Role ?? '').toLowerCase();
  return role === 'bartender' || role === '8';
}

export default function KDSPage() {
  const [user, setUser] = useState<any>(null);
  const userRef = useRef<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');
  const [drinkTimingFilter, setDrinkTimingFilter] = useState<DrinkTimingFilter>('all');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');

    if (tokenFromUrl && userFromUrl) {
      localStorage.setItem('kds_token', tokenFromUrl);
      localStorage.setItem('kds_user', decodeURIComponent(userFromUrl));
      window.history.replaceState({}, '', '/');
    }

    const userData = localStorage.getItem('kds_user');
    const token = localStorage.getItem('kds_token');

    if (!userData || !token) {
      window.location.href = '/login';
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
          localStorage.setItem('kds_user', JSON.stringify(fresh));
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
      const token = localStorage.getItem('kds_token');
      if (!token) return;
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await api.get('/api/order/active');
      const data = response?.data;
      if (!Array.isArray(data)) {
        setOrders([]);
        return;
      }
      // Solo órdenes ya confirmadas por el mesero (Confirmed) o en preparación/listas. Pending = no confirmada.
      const activeOrders = data.filter((order: Order & { status?: string | number }) => {
        const s = order.status;
        if (typeof s === 'number') return s >= 1 && s <= 3; // Confirmed=1, Preparing=2, Ready=3
        return ['Confirmed', 'Preparing', 'Ready'].includes(String(s));
      });

      const currentUser = userRef.current;
      const isBar = isBarUser(currentUser);
      const chefZoneId = !isBar && currentUser ? (currentUser.assignedZoneId ?? currentUser.AssignedZoneId ?? null) : null;

      const kitchenOrders = activeOrders
        .filter((order: Order) => {
          // No mostrar si la sección correspondiente ya fue servida
          // (evita que reaparezca al agregar ítems a una orden ya servida)
          if (isBar) return !(order.barServed ?? false);
          return !(order.kitchenServed ?? false);
        })
        .map((order: Order) => {
          const items = order.items || [];
          let myItems: any[];
          if (isBar) {
            // Bar: solo items que son bebidas
            myItems = items.filter((item: any) => isDrinkItem(item.dishName ?? item.DishName ?? ''));
          } else if (chefZoneId) {
            // Chef con zona asignada: solo items de esa zona (excluyendo bebidas)
            myItems = items.filter((item: any) => {
              const itemZone = item.kitchenZoneId ?? item.KitchenZoneId;
              return itemZone === chefZoneId && !isDrinkItem(item.dishName ?? item.DishName ?? '');
            });
          } else {
            // Chef sin zona: todos los items de comida (sin bebidas)
            myItems = items.filter((item: any) => !isDrinkItem(item.dishName ?? item.DishName ?? ''));
          }
          return { ...order, items: myItems };
        })
        .filter((order: Order) => order.items.length > 0);

      // Ordenar: primero por curso mínimo (Entrada→PlatoFuerte→Postre), luego por hora
      const courseOrder = (order: Order) => {
        const items = order.items || [];
        if (items.length === 0) return 1;
        const min = Math.min(...items.map((i: any) => {
          const c = resolveItemCourse(i);
          return COURSE_META[c]?.order ?? 1;
        }));
        return min;
      };

      kitchenOrders.sort((a: Order, b: Order) => {
        const cDiff = courseOrder(a) - courseOrder(b);
        if (cDiff !== 0) return cDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setOrders(kitchenOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    }
  };

  const getTimeElapsed = (createdAt: string) => {
    // Asegurar que se interprete como UTC (el servidor devuelve sin 'Z')
    const utcStr = createdAt && !createdAt.endsWith('Z') ? createdAt + 'Z' : createdAt;
    const minutes = Math.floor(
      (new Date().getTime() - new Date(utcStr).getTime()) / 60000
    );
    return minutes;
  };

  const getAlertColor = (minutes: number) => {
    if (minutes < 15) return 'bg-green-500';
    if (minutes < 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handlePreparing = async (orderId: number) => {
    const isBar = isBarUser(userRef.current);
    const endpoint = isBar ? `bar-preparing` : `kitchen-preparing`;
    try {
      await api.put(`/api/order/${orderId}/${endpoint}`);
      toast.success('Marcado como Preparando');
      loadOrders();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleReady = async (orderId: number) => {
    const isBar = isBarUser(userRef.current);
    const endpoint = isBar ? `bar-ready` : `kitchen-ready`;
    try {
      await api.put(`/api/order/${orderId}/${endpoint}`);
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

  const isBar = isBarUser(user);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                {isBar ? '🍹 Bar Display System' : '🍳 Kitchen Display System'}
              </h1>
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
                  localStorage.clear();
                  window.location.href = '/login';
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs — Cocina: por curso | Bar: por momento de servicio */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-3 flex gap-2 flex-wrap">
          {isBar ? (
            // Bar: Todos / Antes / Durante / Después
            ([
              { key: 'all',    label: 'Todos',   icon: '🍹' },
              { key: 'Before', label: 'Con la Entrada',      icon: '🥂' },
              { key: 'During', label: 'Con el Plato Fuerte', icon: '🍷' },
              { key: 'After',  label: 'Con el Postre',       icon: '🍸' },
            ] as const).map((tab) => {
              const allItems = orders.flatMap(o => o.items || []);
              const count = tab.key === 'all'
                ? allItems.length
                : allItems.filter((i: any) => resolveDrinkTiming(i) === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setDrinkTimingFilter(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    drinkTimingFilter === tab.key
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${drinkTimingFilter === tab.key ? 'bg-white/20' : 'bg-gray-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })
          ) : (
            // Cocina: Todos / Entrada / Plato Fuerte / Postre
            ([
              { key: 'all',         label: 'Todos',        icon: '📋' },
              { key: 'Entrada',     label: 'Entrada',      icon: '🥗' },
              { key: 'PlatoFuerte', label: 'Plato Fuerte', icon: '🍖' },
              { key: 'Postre',      label: 'Postre',       icon: '🍰' },
            ] as const).map((tab) => {
              const count = tab.key === 'all'
                ? orders.reduce((acc, o) => acc + (o.items || []).length, 0)
                : orders.reduce((acc, o) => acc + (o.items || []).filter((i: any) => resolveItemCourse(i) === tab.key).length, 0);
              return (
                <button
                  key={tab.key}
                  onClick={() => setCourseFilter(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    courseFilter === tab.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${courseFilter === tab.key ? 'bg-white/20' : 'bg-gray-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <Check className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <p className="text-2xl text-gray-400">¡Todo listo! No hay órdenes pendientes</p>
          </div>
        ) : (() => {
          // KDS-NAV.1 — antes: cuando un tab filtraba a 0 items, la página quedaba
          // EN BLANCO (orders.length > 0 → entraba al grid, pero items.length === 0
          // en cada card devolvía null → nada visible). Ahora computamos el total
          // filtrado para mostrar un empty state claro por tab vacío.
          const matchingItemsTotal = orders.reduce((acc, o) => {
            const all = o.items || [];
            const filtered = isBar
              ? (drinkTimingFilter === 'all' ? all : all.filter((i: any) => resolveDrinkTiming(i) === drinkTimingFilter))
              : (courseFilter === 'all' ? all : all.filter((i: any) => resolveItemCourse(i) === courseFilter));
            return acc + filtered.length;
          }, 0);

          if (matchingItemsTotal === 0) {
            const tabLabel = isBar
              ? (DRINK_TIMING_META[drinkTimingFilter as 'Before'|'During'|'After']?.label ?? 'esta categoría')
              : (COURSE_META[courseFilter as 'Entrada'|'PlatoFuerte'|'Postre']?.label ?? 'esta categoría');
            const tabIcon = isBar
              ? (DRINK_TIMING_META[drinkTimingFilter as 'Before'|'During'|'After']?.icon ?? '🍹')
              : (COURSE_META[courseFilter as 'Entrada'|'PlatoFuerte'|'Postre']?.icon ?? '📋');
            return (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">{tabIcon}</div>
                <p className="text-2xl text-gray-300 mb-2">Sin pedidos en <span className="text-primary-400 font-semibold">{tabLabel}</span></p>
                <p className="text-sm text-gray-500">
                  Tienes {orders.length} {orders.length === 1 ? 'orden activa' : 'órdenes activas'},
                  pero ningún ítem está en este filtro. Cambia de tab para verlos.
                </p>
                <button
                  onClick={() => isBar ? setDrinkTimingFilter('all') : setCourseFilter('all')}
                  className="mt-6 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Ver todos
                </button>
              </div>
            );
          }

          return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              const elapsed = getTimeElapsed(order.createdAt);
              const alertColor = getAlertColor(elapsed);
              // Filtrar ítems según el tab seleccionado (curso para cocina, timing para bar)
              const allItems = order.items || [];
              const items = isBar
                ? (drinkTimingFilter === 'all' ? allItems : allItems.filter((i: any) => resolveDrinkTiming(i) === drinkTimingFilter))
                : (courseFilter === 'all' ? allItems : allItems.filter((i: any) => resolveItemCourse(i) === courseFilter));
              if (items.length === 0) return null;
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
                    {items.map((item: any, idx: number) => {
                      // Bar: mostrar timing de bebida; Cocina: mostrar curso
                      const badgeMeta = isBar
                        ? (() => { const tm = DRINK_TIMING_META[resolveDrinkTiming(item)] ?? DRINK_TIMING_META['During']; return { icon: tm.icon, label: tm.label, badge: tm.badge }; })()
                        : (() => { const cm = COURSE_META[resolveItemCourse(item)] ?? COURSE_META['PlatoFuerte']; return { icon: cm.icon, label: cm.label, badge: cm.badge }; })();
                      return (
                      <div key={item.id ?? idx} className={`rounded-lg bg-amber-900/20 border border-amber-600/40 p-3`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-amber-400">{item.quantity}x</span>
                            <span className="text-lg text-white">{item.dishName ?? item.DishName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeMeta.badge}`}>
                              {badgeMeta.icon} {badgeMeta.label}
                            </span>
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
                      );
                    })}
                  </div>

                  {/* Acciones: Preparando → Listo. El mesero confirma en su app. */}
                  <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                    {(() => {
                      const isPreparing = isBar ? order.barPreparing : order.kitchenPreparing;
                      const isReady    = isBar ? order.barReady      : order.kitchenReady;
                      const isServed   = isBar ? order.barServed     : order.kitchenServed;
                      const emoji      = isBar ? '🍹' : '👨‍🍳';

                      if (isServed) {
                        return <div className="text-center py-2 text-teal-400 font-medium">✓ Servido</div>;
                      }
                      if (isReady) {
                        return <div className="text-center py-2 text-green-400 font-medium">✓ Listo — esperando al mesero</div>;
                      }
                      if (isPreparing) {
                        return (
                          <button
                            onClick={() => handleReady(order.id)}
                            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                          >
                            ✅ Listo para Servir
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => handlePreparing(order.id)}
                          className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition-colors"
                        >
                          {emoji} Preparando
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
