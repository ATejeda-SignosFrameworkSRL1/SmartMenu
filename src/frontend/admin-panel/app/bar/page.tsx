'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
  const name = (dishName || '').toLowerCase();
  // Match por PALABRA completa (con plurales), no substring: 'agua' no debe matchear
  // 'aguacate' ni 'ron' a 'macarrones'. Mantener en sync con KDS/waiter/client y backend.
  const words = new Set(name.split(/[^a-záéíóúüñ]+/).filter(Boolean));
  return DRINK_KEYWORDS.some(k =>
    k.includes(' ') ? name.includes(k) : words.has(k) || words.has(k + 's') || words.has(k + 'es')
  );
}

// FASE 2 RUTEO — el flag isDrink del backend (zona del plato) MANDA; el matcher
// por nombre queda solo como fallback para payloads sin el campo.
function itemIsDrink(item: any): boolean {
  const flag = item?.isDrink ?? item?.IsDrink;
  return typeof flag === 'boolean' ? flag : isDrinkItem(item?.dishName ?? item?.DishName ?? '');
}

// Filtro por momento de servicio de bebida
type DrinkTimingFilter = 'all' | 'Before' | 'During' | 'After';

const TIMING_META: Record<string, { labelKey: string; icon: string; colorClass: string; badgeClass: string }> = {
  Before: { labelKey: 'timing.before',  icon: '🥂', colorClass: 'bg-blue-50 border-blue-400 text-blue-800',       badgeClass: 'bg-blue-100 text-blue-700' },
  During: { labelKey: 'timing.during',  icon: '🍷', colorClass: 'bg-purple-50 border-purple-400 text-purple-800', badgeClass: 'bg-purple-100 text-purple-700' },
  After:  { labelKey: 'timing.after',   icon: '🍸', colorClass: 'bg-amber-50 border-amber-400 text-amber-800',    badgeClass: 'bg-amber-100 text-amber-700' },
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
  const t = useTranslations('bar');
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
      toast.success(t('toast.markedPreparing'));
      loadOrders();
    } catch (error) {
      toast.error(t('toast.updateError'));
    }
  };

  const setBarReady = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/bar-ready`);
      toast.success(t('toast.drinksReady'));
      loadOrders();
    } catch (error) {
      toast.error(t('toast.updateError'));
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
      drinkItems: getOrderItems(o).filter((i: any) => itemIsDrink(i)),
    }))
    .filter(o => (o as any).drinkItems.length > 0);

  const queueCount = barOrders.length;

  // Tabs de filtro por DrinkTiming
  const timingTabs = [
    { key: 'all' as DrinkTimingFilter,    label: t('tabs.all'),    icon: '🍹' },
    { key: 'Before' as DrinkTimingFilter, label: t('timing.before'), icon: '🥂' },
    { key: 'During' as DrinkTimingFilter, label: t('timing.during'), icon: '🍷' },
    { key: 'After' as DrinkTimingFilter,  label: t('timing.after'),  icon: '🍸' },
  ];

  function getTimingCount(key: DrinkTimingFilter): number {
    const allDrinks = barOrders.flatMap((o: any) => o.drinkItems);
    if (key === 'all') return allDrinks.length;
    return allDrinks.filter((i: any) => resolveDrinkTiming(i) === key).length;
  }

  if (loading) {
    return (
      <MainLayout title={t('title')} subtitle={t('subtitleLoading')}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('title')} subtitle={t('subtitleQueue')}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wine className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">{t('queueCount', { count: queueCount })}</h2>
              <p className="text-sm text-muted-foreground">{t('pendingDrinks')}</p>
            </div>
          </div>
          <Button onClick={loadOrders} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh')}
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
              <p className="text-xl font-medium text-muted-foreground">{t('emptyState.title')}</p>
              <p className="text-sm text-muted-foreground">{t('emptyState.subtitle')}</p>
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
                        <span className="text-xl font-bold">{((order as any).fulfillmentType ?? (order as any).FulfillmentType) === 'Delivery' ? '🛵 Delivery' : ((order as any).fulfillmentType ?? (order as any).FulfillmentType) === 'Pickup' ? '🛍️ Pickup' : `${t('table')} ${order.tableNumber ?? order.TableNumber ?? '-'}`}</span>
                        <p className="text-xs text-muted-foreground">{t('order')} #{(String(order.orderNumber ?? order.OrderNumber ?? '')).split('-').pop()?.toUpperCase() || '-'}</p>
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
                                {tm.icon} {t(tm.labelKey as any)}
                              </span>
                            </div>
                            {(item.notes ?? item.Notes) && (
                              <p className="text-xs text-muted-foreground mt-1">{t('noteLabel')}: {item.notes ?? item.Notes}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 mt-4">
                      {!(order.barPreparing ?? order.BarPreparing) ? (
                        <Button className="flex-1" onClick={() => setBarPreparing(order.id)}>
                          <Clock className="h-5 w-5 mr-2" />
                          {t('actions.preparing')}
                        </Button>
                      ) : !(order.barReady ?? order.BarReady) ? (
                        <Button className="flex-1" onClick={() => setBarReady(order.id)}>
                          <Check className="h-5 w-5 mr-2" />
                          {t('actions.ready')}
                        </Button>
                      ) : (
                        <Button className="flex-1" variant="secondary" disabled>
                          <Check className="h-5 w-5 mr-2" />
                          {t('actions.drinksReady')}
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
