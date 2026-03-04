'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wine,
  Check,
  RefreshCw,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

interface OrderItem {
  id: number;
  dishId: number;
  dishName: string;
  quantity: number;
  notes?: string;
  isReady: boolean;
}

interface Order {
  id: number;
  orderNumber: string;
  tableNumber: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function BarPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const response = await api.get('/api/order');
      // Filter only active bar orders (orders with drink items)
      const activeOrders = response.data.filter((o: Order) => 
        ['Confirmed', 'Preparing'].includes(o.status) &&
        o.items.some((item: OrderItem) => 
          item.dishName.toLowerCase().includes('cerveza') ||
          item.dishName.toLowerCase().includes('vino') ||
          item.dishName.toLowerCase().includes('cóctel') ||
          item.dishName.toLowerCase().includes('margarita') ||
          item.dishName.toLowerCase().includes('mojito') ||
          item.dishName.toLowerCase().includes('refresco')
        )
      );
      setOrders(activeOrders.sort((a: Order, b: Order) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Error loading bar orders:', error);
      toast.error('Error al cargar bebidas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const markItemReady = async (orderId: number, itemId: number) => {
    try {
      // TODO: Implement mark item as ready endpoint
      toast.success('Bebida lista');
      loadOrders();
    } catch (error) {
      toast.error('Error al marcar bebida');
    }
  };

  const getElapsedMinutes = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
  };

  if (loading) {
    return (
      <MainLayout title="Bar" subtitle="Cola de bebidas">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Bar" subtitle="Cola de bebidas y cócteles">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <Wine className="h-10 w-10 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Bar</h1>
                <p className="text-muted-foreground">Cola de bebidas y cócteles</p>
              </div>
            </div>
          </div>
          <Button onClick={loadOrders} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{orders.length}</div>
              <p className="text-xs text-muted-foreground">Pedidos en cola</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {orders.reduce((sum, o) => sum + o.items.filter(i => 
                  i.dishName.toLowerCase().includes('cerveza') ||
                  i.dishName.toLowerCase().includes('vino') ||
                  i.dishName.toLowerCase().includes('cóctel') ||
                  i.dishName.toLowerCase().includes('margarita') ||
                  i.dishName.toLowerCase().includes('mojito') ||
                  i.dishName.toLowerCase().includes('refresco')
                ).length, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Bebidas pendientes</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders Grid */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wine className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No hay bebidas pendientes</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => {
              const elapsed = getElapsedMinutes(order.createdAt);
              const drinkItems = order.items.filter(item => 
                item.dishName.toLowerCase().includes('cerveza') ||
                item.dishName.toLowerCase().includes('vino') ||
                item.dishName.toLowerCase().includes('cóctel') ||
                item.dishName.toLowerCase().includes('margarita') ||
                item.dishName.toLowerCase().includes('mojito') ||
                item.dishName.toLowerCase().includes('refresco')
              );

              return (
                <Card 
                  key={order.id}
                  className={cn(
                    "border-4",
                    elapsed > 10 ? "border-yellow-500 bg-yellow-50" : "border-green-500 bg-green-50"
                  )}
                >
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold">Mesa {order.tableNumber}</h3>
                        <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "flex items-center gap-1 text-lg font-bold",
                          elapsed > 10 ? "text-yellow-600" : "text-green-600"
                        )}>
                          <Clock className="h-4 w-4" />
                          {elapsed} min
                        </div>
                      </div>
                    </div>

                    {/* Drink Items Only */}
                    <div className="space-y-2 mb-4">
                      {drinkItems.map((item) => (
                        <div 
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded",
                            item.isReady ? "bg-green-100" : "bg-white"
                          )}
                        >
                          <div className="flex-1">
                            <span className="font-bold text-lg">{item.quantity}x</span>
                            <span className="ml-2">{item.dishName}</span>
                            {item.notes && (
                              <div className="text-xs text-orange-600 mt-1">
                                ⚠️ {item.notes}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={item.isReady ? "secondary" : "default"}
                            onClick={() => markItemReady(order.id, item.id)}
                            disabled={item.isReady}
                          >
                            {item.isReady ? <Check className="h-4 w-4" /> : "Listo"}
                          </Button>
                        </div>
                      ))}
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
