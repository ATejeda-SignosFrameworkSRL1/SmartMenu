'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, ShoppingBag, CreditCard, TrendingUp, Clock, ChefHat, Wine, AlertCircle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import axios from 'axios';

const api = axios.create({
  baseURL: '',
});

function AdminDashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [dishAvgTimes, setDishAvgTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Leer token desde URL si viene del login
    const urlToken = searchParams.get('token');
    const urlUser = searchParams.get('user');
    if (urlToken) {
      localStorage.setItem('admin_token', urlToken);
      if (urlUser) localStorage.setItem('user', decodeURIComponent(urlUser));
      // Limpiar la URL sin recargar
      router.replace('/');
      return;
    }

    const token = localStorage.getItem('admin_token');
    if (!token) {
      setLoading(false);
      const loginUrl = `${window.location.protocol}//${window.location.hostname}:3000/login`;
      window.location.href = loginUrl;
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [tablesRes, ordersRes, dishesRes, avgTimesRes] = await Promise.all([
        api.get('/api/table'),
        api.get('/api/order/active'),
        api.get('/api/dish'),
        api.get('/api/reports/dish-avg-time').catch(() => ({ data: [] }))
      ]);

      setTables(Array.isArray(tablesRes.data) ? tablesRes.data : []);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setDishes(Array.isArray(dishesRes.data) ? dishesRes.data : []);
      setDishAvgTimes(Array.isArray(avgTimesRes.data) ? avgTimesRes.data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const activeTables = tables.filter((t: any) => (t.status || t.Status) === 'Occupied');
  const availableTables = tables.filter((t: any) => (t.status || t.Status) === 'Available');
  const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.total ?? order.Total ?? 0), 0);
  const preparingOrders = orders.filter((o: any) => (o.status || o.Status) === 'Preparing');
  
  const stats = [
    { 
      label: 'Mesas Disponibles', 
      value: availableTables.length.toString(), 
      change: `${availableTables.length}/${tables.length}`,
      icon: LayoutDashboard, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30'
    },
    { 
      label: 'Mesas Ocupadas', 
      value: activeTables.length.toString(), 
      change: `${tables.length > 0 ? Math.round((activeTables.length / tables.length) * 100) : 0}% ocupación`,
      icon: Users, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/30'
    },
    { 
      label: 'Pedidos en Cocina', 
      value: preparingOrders.length.toString(), 
      change: 'En preparación',
      icon: ChefHat, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30'
    },
    { 
      label: 'Platillos Activos', 
      value: dishes.filter((d: any) => d.isAvailable ?? d.IsAvailable ?? true).length.toString(), 
      change: `${dishes.length} total`,
      icon: Wine, 
      color: 'text-info',
      bgColor: 'bg-info/10',
      borderColor: 'border-info/30'
    },
  ];

  const bottomStats = [
    {
      label: 'Órdenes Activas',
      value: orders.length.toString(),
      subtext: 'del turno',
      icon: ShoppingBag,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      label: 'Ventas del Día',
      value: `RD$ ${totalRevenue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      subtext: 'órdenes activas',
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      label: 'Ticket Promedio',
      value: orders.length > 0 ? `RD$ ${(totalRevenue / orders.length).toFixed(2)}` : 'RD$ 0.00',
      subtext: 'por orden',
      icon: TrendingUp,
      color: 'text-info',
      bgColor: 'bg-info/10'
    },
    {
      label: 'Tiempo Promedio',
      value: dishAvgTimes.length > 0
        ? `${Math.round(dishAvgTimes.reduce((s: number, d: any) => s + (d.avgMinutes ?? 0), 0) / dishAvgTimes.length)} min`
        : '— min',
      subtext: `${dishAvgTimes.length} platos medidos`,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    }
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-warning',
      confirmed: 'bg-info',
      preparing: 'bg-primary',
      ready: 'bg-success',
      served: 'bg-muted',
      completed: 'bg-muted'
    };
    return colors[status.toLowerCase()] || 'bg-gray-500';
  };

  const getElapsedMinutes = (createdAt: string) => {
    const now = new Date().getTime();
    const created = new Date(createdAt).getTime();
    return Math.floor((now - created) / 60000);
  };

  const getAlertColor = (minutes: number) => {
    if (minutes > 30) return 'text-danger';
    if (minutes > 15) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <MainLayout title="Dashboard">

      <div className="space-y-6">
        {/* Top Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className={cn('border-2', stat.borderColor)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-sm font-medium">{stat.label}</CardDescription>
                    <div className={cn('rounded-lg p-2', stat.bgColor)}>
                      <Icon className={cn('h-5 w-5', stat.color)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {bottomStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-4">
                    <div className={cn('rounded-lg p-3', stat.bgColor)}>
                      <Icon className={cn('h-6 w-6', stat.color)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tiempo Promedio por Plato */}
        {dishAvgTimes.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-warning" />
                    Tiempo Promedio por Plato
                  </CardTitle>
                  <CardDescription>Tiempo real desde la orden hasta servida (últimos 30 días)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dishAvgTimes.slice(0, 10).map((d: any) => {
                  const avg = Math.round(d.avgMinutes ?? 0);
                  const est = d.estimatedMinutes ?? 0;
                  const ratio = est > 0 ? avg / est : 1;
                  const barColor = ratio > 1.3 ? 'bg-red-500' : ratio > 1 ? 'bg-amber-400' : 'bg-emerald-500';
                  const maxMin = Math.max(...dishAvgTimes.map((x: any) => x.avgMinutes ?? 0), 1);
                  return (
                    <div key={d.dishId} className="flex items-center gap-3">
                      <div className="w-40 truncate text-sm font-medium">{d.dishName}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${(avg / maxMin) * 100}%` }} />
                      </div>
                      <div className="text-sm font-bold w-16 text-right">{avg} min</div>
                      <div className="text-xs text-muted-foreground w-20 text-right">est. {est} min</div>
                      <Badge variant="outline" className={`text-xs ${ratio > 1.3 ? 'border-red-300 text-red-600' : ratio > 1 ? 'border-amber-300 text-amber-600' : 'border-emerald-300 text-emerald-600'}`}>
                        {d.orderCount} ord
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Órdenes Activas</CardTitle>
                <CardDescription>Pedidos en curso en tiempo real</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadData}>
                <Clock className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando órdenes...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay órdenes para mostrar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 8).map((order: any) => {
                  const status = order.status ?? order.Status ?? '';
                  const createdAt = order.createdAt ?? order.CreatedAt ?? '';
                  const elapsed = createdAt ? getElapsedMinutes(createdAt) : 0;
                  const total = order.total ?? order.Total ?? 0;
                  return (
                    <div 
                      key={order.id ?? order.Id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className={cn('rounded-full h-3 w-3', getStatusColor(status))} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{order.orderNumber ?? order.OrderNumber}</p>
                          <p className="text-xs text-muted-foreground">Mesa {order.tableNumber ?? order.TableNumber ?? order.tableId ?? order.TableId}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {status}
                          </Badge>
                          <p className={cn('text-xs mt-1', getAlertColor(elapsed))}>
                            <Clock className="h-3 w-3 inline mr-1" />
                            {elapsed} min
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">RD$ {Number(total).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{order.items?.length ?? 0} items</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/menu">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <ShoppingBag className="h-6 w-6" />
                  <span className="text-sm">Gestionar Menú</span>
                </Button>
              </Link>
              <Link href="/tables">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <LayoutDashboard className="h-6 w-6" />
                  <span className="text-sm">Ver Mesas</span>
                </Button>
              </Link>
              <Link href="/users">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Personal</span>
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <TrendingUp className="h-6 w-6" />
                  <span className="text-sm">Reportes</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardInner />
    </Suspense>
  );
}
