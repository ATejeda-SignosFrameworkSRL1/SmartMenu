'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Check, ChefHat, AlertCircle, RefreshCw, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

// KDS Cocina: solo mostrar ítems de comida (no bebidas); las bebidas van al KDS Bar
const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  return DRINK_KEYWORDS.some(k => name.includes(k));
}
function orderHasFoodItem(order: any): boolean {
  const items = order?.items ?? order?.Items ?? [];
  return items.some((i: any) => !isDrinkItem(i?.dishName ?? i?.DishName ?? ''));
}
function getFoodItems(order: any): any[] {
  const items = order?.items ?? order?.Items ?? [];
  return items.filter((i: any) => !isDrinkItem(i?.dishName ?? i?.DishName ?? ''));
}

// Filtro por curso (igual que KDS app)
type CourseFilter = 'all' | 'Entrada' | 'PlatoFuerte' | 'Postre';

const COURSE_META: Record<string, { label: string; icon: string; colorClass: string; badgeClass: string }> = {
  Entrada:     { label: 'Entrada',      icon: '🥗', colorClass: 'bg-green-50 border-green-400 text-green-800',   badgeClass: 'bg-green-100 text-green-700' },
  PlatoFuerte: { label: 'Plato Fuerte', icon: '🍖', colorClass: 'bg-orange-50 border-orange-400 text-orange-800', badgeClass: 'bg-orange-100 text-orange-700' },
  Postre:      { label: 'Postre',       icon: '🍰', colorClass: 'bg-pink-50 border-pink-400 text-pink-800',       badgeClass: 'bg-pink-100 text-pink-700' },
};

const DRINK_TIMING_TO_COURSE: Record<number, string> = { 0: 'Entrada', 1: 'PlatoFuerte', 2: 'Postre' };

function resolveItemCourse(item: any): string {
  const ct = item.courseTiming ?? item.CourseTiming;
  if (ct) return ct;
  const dt = item.drinkTiming ?? item.DrinkTiming;
  if (dt !== undefined && dt !== null) {
    const dtNum = typeof dt === 'string' ? ['Before', 'During', 'After'].indexOf(dt) : dt;
    return DRINK_TIMING_TO_COURSE[dtNum] ?? 'PlatoFuerte';
  }
  return 'PlatoFuerte';
}

interface OrderItem {
  id: number;
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  isReady: boolean;
}

interface Order {
  id: number;
  orderNumber: string;
  tableId: number;
  tableNumber: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  createdAt: string;
  items: OrderItem[];
  specialInstructions?: string;
}

function getElapsedMinutes(createdAt: string | number | undefined): number {
  if (createdAt == null) return 0;
  const utcStr = typeof createdAt === 'string' && !createdAt.endsWith('Z') ? createdAt + 'Z' : createdAt;
  const start = new Date(utcStr as string).getTime();
  return Math.floor((Date.now() - start) / 60000);
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');

  const loadOrders = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/order/active');
      const data = Array.isArray(res.data) ? res.data : [];
      const getCreatedAt = (o: any) => o?.createdAt ?? o?.CreatedAt ?? 0;
      setOrders(data.sort((a: any, b: any) =>
        new Date(getCreatedAt(a)).getTime() - new Date(getCreatedAt(b)).getTime()
      ));
    } catch (error) {
      console.error('Error loading kitchen orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const setKitchenPreparing = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/kitchen-preparing`);
      toast.success('Marcado como Preparando');
      loadOrders();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const setKitchenReady = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/kitchen-ready`);
      toast.success('Comida marcada como lista');
      loadOrders();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const getOrderStatus = (o: any) => o?.status ?? o?.Status ?? '';
  const getOrderItems = (o: any) => o?.items ?? o?.Items ?? [];
  // Solo pedidos que tienen al menos un ítem de comida (las bebidas van al Bar).
  // Excluir órdenes donde la cocina ya sirvió su parte (KitchenServed=true)
  // para evitar que reaparezcan cuando el cliente agrega bebidas a una orden ya servida.
  const activeOrders = orders.filter(o => {
    const kitchenServed = (o as any)?.kitchenServed ?? (o as any)?.KitchenServed ?? false;
    return ['Pending', 'Confirmed', 'Preparing', 'Ready'].includes(getOrderStatus(o))
      && orderHasFoodItem(o)
      && !kitchenServed;
  });
  const urgentCount = activeOrders.filter(o => getElapsedMinutes((o as any).createdAt ?? (o as any).CreatedAt) > 15).length;

  if (loading) {
    return (
      <MainLayout title="Cocina" subtitle="Kitchen Display System">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Tabs de curso: contar ítems según filtro
  const courseTabs = [
    { key: 'all' as CourseFilter,         label: 'Todos',       icon: '📋' },
    { key: 'Entrada' as CourseFilter,     label: 'Entrada',     icon: '🥗' },
    { key: 'PlatoFuerte' as CourseFilter, label: 'Plato Fuerte',icon: '🍖' },
    { key: 'Postre' as CourseFilter,      label: 'Postre',      icon: '🍰' },
  ];

  function getCourseCount(key: CourseFilter): number {
    const items = activeOrders.flatMap((o: any) => getFoodItems(o));
    if (key === 'all') return items.length;
    return items.filter((i: any) => resolveItemCourse(i) === key).length;
  }

  return (
    <MainLayout title="Cocina (KDS)" subtitle="Kitchen Display System">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ChefHat className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Pedidos de cocina (comida): {activeOrders.length}</h2>
                {urgentCount > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1 px-3 py-1">
                    <Flame className="h-4 w-4" />
                    {urgentCount} urgentes
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1" />Normal</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1" />&gt;15min</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" />&gt;25min</span>
              </div>
            </div>
          </div>
          <Button onClick={loadOrders} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Filtro por curso */}
        <div className="flex gap-2 flex-wrap border-b pb-4">
          {courseTabs.map(tab => {
            const count = getCourseCount(tab.key);
            const isActive = courseFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setCourseFilter(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={cn(
                  'ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold',
                  isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {activeOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <ChefHat className="h-20 w-20 text-muted-foreground/20 mb-4" />
              <p className="text-xl font-medium text-muted-foreground">No hay pedidos de comida en cola</p>
              <p className="text-sm text-muted-foreground">Solo aparecen ítems de comida; las bebidas van al Bar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.map((order: any) => {
              const elapsed = getElapsedMinutes(order.createdAt ?? order.CreatedAt);
              const isUrgent = elapsed > 25;
              const isWarning = elapsed > 15;
              const allFoodItems = getFoodItems(order);
              // Aplicar filtro de curso
              const items = courseFilter === 'all'
                ? allFoodItems
                : allFoodItems.filter((i: any) => resolveItemCourse(i) === courseFilter);
              if (items.length === 0) return null;

              const specialInstructions = order.specialInstructions ?? order.SpecialInstructions ?? '';
              const hasAllergies = items.some((i: any) =>
                ((i.notes ?? i.Notes) || '').toLowerCase().includes('alergia') || specialInstructions.toLowerCase().includes('alergia')
              );

              return (
                <Card
                  key={order.id}
                  className={cn(
                    'border-2 transition-all',
                    isUrgent && 'border-destructive bg-destructive/5',
                    isWarning && !isUrgent && 'border-yellow-500 bg-yellow-500/5',
                    !isWarning && !isUrgent && 'border-green-500 bg-green-500/5'
                  )}
                >
                  <CardContent className="p-4">
                    <div className={cn(
                      'flex items-center justify-between mb-4 pb-2 border-b',
                      isUrgent && 'border-destructive',
                      isWarning && !isUrgent && 'border-yellow-500',
                      !isWarning && !isUrgent && 'border-green-500'
                    )}>
                      <div>
                        <span className="text-2xl font-bold">Mesa {order.tableNumber ?? order.TableNumber ?? '-'}</span>
                        <p className="text-xs text-muted-foreground">Orden #{order.orderNumber ?? order.OrderNumber ?? '-'}</p>
                        {hasAllergies && (
                          <div className="flex items-center gap-1 text-destructive mt-1">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase">Alergía</span>
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        'font-mono text-lg font-bold px-2 py-1 rounded',
                        isUrgent && 'bg-destructive text-white',
                        isWarning && !isUrgent && 'bg-yellow-500 text-white',
                        !isWarning && !isUrgent && 'bg-green-500 text-white'
                      )}>
                        {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')} min
                      </div>
                    </div>

                    {hasAllergies && (
                      <div className="bg-destructive/10 border border-destructive rounded-lg p-2 mb-3 text-sm font-medium text-destructive">
                        ATENCIÓN: Este pedido contiene alergias
                      </div>
                    )}

                    <div className="space-y-2">
                      {items.map((item: any) => {
                        const course = resolveItemCourse(item);
                        const cm = COURSE_META[course] ?? COURSE_META['PlatoFuerte'];
                        return (
                          <div key={item.id ?? item.dishId ?? item.DishId} className="rounded-lg border p-3 bg-card">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-lg">{item.quantity ?? 0}x {item.dishName ?? item.DishName ?? ''}</span>
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap', cm.colorClass)}>
                                {cm.icon} {cm.label}
                              </span>
                            </div>
                            {(item.notes ?? item.Notes) && (
                              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                {item.notes ?? item.Notes}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 mt-4">
                      {!(order.kitchenPreparing ?? order.KitchenPreparing) ? (
                        <Button className="flex-1 font-bold" onClick={() => setKitchenPreparing(order.id)}>
                          <Clock className="h-5 w-5 mr-2" />
                          Preparando
                        </Button>
                      ) : !(order.kitchenReady ?? order.KitchenReady) ? (
                        <Button className="flex-1 font-bold" onClick={() => setKitchenReady(order.id)}>
                          <Check className="h-5 w-5 mr-2" />
                          Listo
                        </Button>
                      ) : (
                        <Button className="flex-1 font-bold" variant="secondary" disabled>
                          <Check className="h-5 w-5 mr-2" />
                          Comida lista
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
