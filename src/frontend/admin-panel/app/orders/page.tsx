'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock,
  RefreshCw,
  Eye,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

interface Order {
  id: number;
  orderNumber: string;
  tableNumber: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  createdAt: string;
  items: Array<{
    id: number;
    dishName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

const STATUS_OPTIONS = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled'];

const STATUS_LABELS: Record<string, string> = {
  'Pending': 'Pendiente',
  'Confirmed': 'Confirmada',
  'Preparing': 'Preparando',
  'Ready': 'Lista',
  'Served': 'Servida',
  'Completed': 'Completada',
  'Cancelled': 'Cancelada'
};

const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Confirmed': 'bg-blue-100 text-blue-800 border-blue-200',
  'Preparing': 'bg-purple-100 text-purple-800 border-purple-200',
  'Ready': 'bg-green-100 text-green-800 border-green-200',
  'Served': 'bg-teal-100 text-teal-800 border-teal-200',
  'Completed': 'bg-gray-100 text-gray-800 border-gray-200',
  'Cancelled': 'bg-red-100 text-red-800 border-red-200'
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const response = await api.get('/api/order/all');
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Error al cargar órdenes');
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
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      await api.put(`/api/order/${orderId}/status`, { newStatus });
      toast.success('Estado actualizado');
      loadOrders();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const getStatus = (o: Order) => (o as any).status ?? (o as any).Status ?? '';
  const filteredOrders = selectedStatus === 'all' 
    ? orders 
    : orders.filter(o => getStatus(o) === selectedStatus);

  const statusCounts = STATUS_OPTIONS.reduce((acc, status) => {
    acc[status] = orders.filter(o => getStatus(o) === status).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Órdenes</h1>
            <p className="text-muted-foreground">Administra el estado de las órdenes</p>
          </div>
          <Button onClick={loadOrders} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Status Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedStatus('all')}
                size="sm"
              >
                Todas ({orders.length})
              </Button>
              {STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  variant={selectedStatus === status ? 'default' : 'outline'}
                  onClick={() => setSelectedStatus(status)}
                  size="sm"
                >
                  {STATUS_LABELS[status]} ({statusCounts[status] || 0})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando órdenes...</p>
              </CardContent>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No hay órdenes para mostrar</p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{(order as any).orderNumber ?? (order as any).OrderNumber}</h3>
                      <p className="text-sm text-muted-foreground">Mesa {(order as any).tableNumber ?? (order as any).TableNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date((order as any).createdAt ?? (order as any).CreatedAt ?? 0).toLocaleString('es-DO')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={cn('border-2', STATUS_COLORS[getStatus(order)] || 'bg-gray-100')}>
                        {STATUS_LABELS[getStatus(order)] || getStatus(order)}
                      </Badge>
                      <p className="text-2xl font-bold mt-2">
                        RD$ {((order as any).total ?? (order as any).Total ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="mb-4 space-y-2">
                    {(order.items ?? []).map((item: any) => (
                      <div key={item.id ?? item.Id} className="flex justify-between text-sm border-b pb-2">
                        <span className="font-medium">
                          {item.quantity}x {item.dishName ?? item.DishName}
                        </span>
                        <span className="text-muted-foreground">
                          RD$ {(item.subtotal ?? item.Subtotal ?? 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Change Status */}
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-sm font-medium text-muted-foreground mr-2">
                      Cambiar estado:
                    </span>
                    {STATUS_OPTIONS.filter(s => s !== getStatus(order)).map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, status)}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
