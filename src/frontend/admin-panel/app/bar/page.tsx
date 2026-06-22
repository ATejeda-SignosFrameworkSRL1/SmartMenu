'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Check, Wine, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

interface OrderItem {
  id: number;
  dishName: string;
  quantity: number;
  notes?: string;
  drinkTiming?: string | number;
}

interface Order {
  id: number;
  orderNumber: string;
  tableNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];

function isDrinkItem(dishName: string): boolean {
  const name = dishName.toLowerCase();
  return DRINK_KEYWORDS.some(k => name.includes(k));
}

// Filtro por momento de servicio de bebida
type DrinkTimingFilter = 'all' | 'Before' | 'During' | 'After';

const TIMING_META: Record<string, { label: string; icon: string; colorClass: string; badgeClass: string }> = {
  Before: { label: 'Con la Entrada',      icon: '🥂', colorClass: 'bg-blue-50 border-blue-400 text-blue-800',       badgeClass: 'bg-blue-100 text-blue-700' },
  During: { label: 'Con el Plato Fuerte', icon: '🍷', colorClass: 'bg-purple-50 border-purple-400 text-purple-800', badgeClass: 'bg-purple-100 text-purple-700' },
  After:  { label: 'Con el Postre',       icon: '🍸', colorClass: 'bg-amber-50 border-amber-400 text-amber-800',    badgeClass: 'bg-amber-100 text-amber-700' },
};

// Resuelve el drinkTiming de un ítem → 'Before' | 'During' | 'After'
function resolveDrinkTiming(item: any): string {
  const dt = item.drinkTiming ?? item.DrinkTiming;
  if (dt === undefined || dt === null) return 'During'; // default
  if (typeof dt === 'string') {
    if (['Before', 'During', 'After'].includes(dt)) return dt;
    const idx = ['Before', 'During', 'After'].indexOf(dt);
    if (idx >= 0) return ['Before', 'During', 'After'][idx];
  }
  const num = Number(dt);
  return ['Before', 'During', 'After'][num] ?? 'During';
}

function getElapsedMinutes(createdAt: string | number | undefined): number {
  if (createdAt == null) return 0;
  const utcStr = typeof createdAt === 'string' && !createdAt.endsWith('Z') ? createdAt + 'Z' : createdAt;
  return Math.floor((Date.now() - new Date(utcStr as string).getTime()) / 60000);
}

export default function BarPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timingFilter, setTimingFilter] = useState<DrinkTimingFilter>('all');

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
      console.error('Error loading bar orders:', error);
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
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const setBarPreparing = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/bar-preparing`);
      toast.success('Marcado como Preparando');
      loadOrders();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const setBarReady = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/bar-ready`);
      toast.success('Bebidas marcadas como listas');
      loadOrders();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const getOrderStatus = (o: any) => o?.status ?? o?.Status ?? '';
  const getOrderItems = (o: any) => o?.items ?? o?.Items ?? [];
  const getItemDishName = (i: any) => i?.dishName ?? i?.DishName ?? '';

  // Todas las órdenes con al menos una bebida.
  // Excluir órdenes donde el bar ya sirvió su parte (BarServed=true)
  // para evitar que reaparezcan cuando el cliente agrega comida a una orden ya servida.
  const barOrders = orders
    .filter(o => {
      const barServed = (o as any)?.barServed ?? (o as any)?.BarServed ?? false;
      return ['Pending', 'Confirmed', 'Preparing', 'Ready'].includes(getOrderStatus(o)) && !barServed;
    })
    .map(o => ({
      ...o,
      drinkItems: getOrderItems(o).filter((i: any) => isDrinkItem(getItemDishName(i))),
    }))
    .filter(o => (o as any).drinkItems.length > 0);

  const queueCount = barOrders.length;

  // Tabs de filtro por DrinkTiming
  const timingTabs = [
    { key: 'all' as DrinkTimingFilter,    label: 'Todos',   icon: '🍹' },
    { key: 'Before' as DrinkTimingFilter, label: 'Con la Entrada',      icon: '🥂' },
    { key: 'During' as DrinkTimingFilter, label: 'Con el Plato Fuerte', icon: '🍷' },
    { key: 'After' as DrinkTimingFilter,  label: 'Con el Postre',       icon: '🍸' },
  ];

  function getTimingCount(key: DrinkTimingFilter): number {
    const allDrinks = barOrders.flatMap((o: any) => o.drinkItems);
    if (key === 'all') return allDrinks.length;
    return allDrinks.filter((i: any) => resolveDrinkTiming(i) === key).length;
  }

  if (loading) {
    return (
      <MainLayout title="Bar" subtitle="Sistema de bebidas">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Bar" subtitle="Cola de bebidas y cócteles">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wine className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Pedidos en cola: {queueCount}</h2>
              <p className="text-sm text-muted-foreground">Bebidas pendientes de preparación</p>
            </div>
          </div>
          <Button onClick={loadOrders} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Filtro por momento de servicio */}
        <div className="flex gap-2 flex-wrap border-b pb-4">
          {timingTabs.map(tab => {
            const count = getTimingCount(tab.key);
            const isActive = timingFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setTimingFilter(tab.key)}
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

        {queueCount === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Wine className="h-20 w-20 text-muted-foreground/20 mb-4" />
              <p className="text-xl font-medium text-muted-foreground">No hay bebidas pendientes</p>
              <p className="text-sm text-muted-foreground">Los nuevos pedidos aparecerán aquí</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {barOrders.map((order: any) => {
              const elapsed = getElapsedMinutes(order.createdAt ?? order.CreatedAt);
              const isUrgent = elapsed > 20;

              // Filtrar bebidas por timing seleccionado
              const visibleItems: any[] = timingFilter === 'all'
                ? order.drinkItems
                : order.drinkItems.filter((i: any) => resolveDrinkTiming(i) === timingFilter);
              if (visibleItems.length === 0) return null;

              return (
                <Card key={order.id} className={cn(
                  'border-2 transition-all',
                  isUrgent ? 'border-destructive bg-destructive/5' : 'border-primary/30 bg-primary/5'
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                      <div>
                        <span className="text-xl font-bold">Mesa {order.tableNumber ?? order.TableNumber ?? '-'}</span>
                        <p className="text-xs text-muted-foreground">Pedido #{(String(order.orderNumber ?? order.OrderNumber ?? '')).split('-').pop()?.toUpperCase() || '-'}</p>
                      </div>
                      <span className={cn(
                        'font-mono font-bold px-2 py-1 rounded text-sm',
                        isUrgent ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'
                      )}>
                        {elapsed}m
                      </span>
                    </div>

                    <div className="space-y-2">
                      {visibleItems.map((item: any) => {
                        const timing = resolveDrinkTiming(item);
                        const tm = TIMING_META[timing] ?? TIMING_META['During'];
                        return (
                          <div key={item.id ?? item.DishId} className="rounded-lg border p-3 bg-card">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{item.quantity ?? 0}x {getItemDishName(item)}</span>
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap', tm.colorClass)}>
                                {tm.icon} {tm.label}
                              </span>
                            </div>
                            {(item.notes ?? item.Notes) && (
                              <p className="text-xs text-muted-foreground mt-1">Nota: {item.notes ?? item.Notes}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 mt-4">
                      {!(order.barPreparing ?? order.BarPreparing) ? (
                        <Button className="flex-1" onClick={() => setBarPreparing(order.id)}>
                          <Clock className="h-5 w-5 mr-2" />
                          Preparando
                        </Button>
                      ) : !(order.barReady ?? order.BarReady) ? (
                        <Button className="flex-1" onClick={() => setBarReady(order.id)}>
                          <Check className="h-5 w-5 mr-2" />
                          Listo
                        </Button>
                      ) : (
                        <Button className="flex-1" variant="secondary" disabled>
                          <Check className="h-5 w-5 mr-2" />
                          Bebidas listas
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
