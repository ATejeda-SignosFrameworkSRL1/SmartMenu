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

function getElapsedMinutes(createdAt: string | number | undefined): number {
  if (createdAt == null) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

export default function BarPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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
      window.location.href = 'https://172.31.98.64:3000/login';
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
  const barOrders = orders.filter(o =>
    ['Pending', 'Confirmed', 'Preparing', 'Ready'].includes(getOrderStatus(o))
  ).map(o => ({
    ...o,
    drinkItems: getOrderItems(o).filter((i: any) => isDrinkItem(getItemDishName(i)))
  })).filter(o => (o as any).drinkItems?.length > 0);

  const queueCount = barOrders.length;

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

              return (
                <Card key={order.id} className={cn(
                  'border-2 transition-all',
                  isUrgent ? 'border-destructive bg-destructive/5' : 'border-primary/30 bg-primary/5'
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                      <span className="text-xl font-bold">Mesa {order.tableNumber ?? order.TableNumber ?? '-'}</span>
                      <span className={cn(
                        'font-mono font-bold px-2 py-1 rounded text-sm',
                        isUrgent ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'
                      )}>
                        {elapsed}m
                      </span>
                    </div>
                    <div className="space-y-3">
                      {(order.drinkItems ?? []).map((item: any) => (
                        <div key={item.id ?? item.DishId} className="flex items-center justify-between p-3 rounded-lg bg-card border">
                          <span className="font-medium">{item.quantity ?? 0}x {getItemDishName(item)}</span>
                          {(item.notes ?? item.Notes) && <span className="text-xs text-muted-foreground">{item.notes ?? item.Notes}</span>}
                        </div>
                      ))}
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
