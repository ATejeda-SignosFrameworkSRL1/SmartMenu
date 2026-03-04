'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  ChefHat,
  RefreshCw,
  Calendar
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

interface ReportData {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalDishes: number;
  ordersToday: number;
  revenueToday: number;
  topDishes: Array<{
    dishName: string;
    quantity: number;
    revenue: number;
  }>;
  ordersByStatus: Array<{
    status: string;
    count: number;
  }>;
}

interface WaiterReportRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  totalSales: number;
  totalTips: number;
  transactionCount: number;
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [waiterReport, setWaiterReport] = useState<WaiterReportRow[]>([]);
  const [waiterDetail, setWaiterDetail] = useState<any>(null);
  const [waiterDetailId, setWaiterDetailId] = useState<number | null>(null);

  const emptyReportData = (): ReportData => ({
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    totalDishes: 0,
    ordersToday: 0,
    revenueToday: 0,
    topDishes: [],
    ordersByStatus: [],
  });

  const loadReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        window.location.href = 'https://172.31.98.64:3000/login';
        return;
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const [ordersRes, dishesRes, customersRes] = await Promise.all([
        api.get('/api/order/all'),
        api.get('/api/dish', { params: { all: true } }),
        api.get('/api/user')
      ]);

      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data?.data ?? []);
      const dishes = Array.isArray(dishesRes.data) ? dishesRes.data : (dishesRes.data?.data ?? []);
      const customersRaw = Array.isArray(customersRes.data) ? customersRes.data : (customersRes.data?.data ?? []);
      const customers = customersRaw.filter((u: any) => (u.role || u.Role) === 'Customer');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const ordersToday = orders.filter((o: any) => {
        const orderDate = new Date(o.createdAt ?? o.CreatedAt ?? 0);
        return orderDate >= today;
      });

      const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total ?? o.totalAmount ?? 0), 0);
      const revenueToday = ordersToday.reduce((sum: number, o: any) => sum + (o.total ?? o.totalAmount ?? 0), 0);

      // Top dishes
      const dishCounts: Record<number, { name: string; quantity: number; revenue: number }> = {};
      orders.forEach((order: any) => {
        order.items?.forEach((item: any) => {
          const dishId = item.dishId ?? item.DishId ?? item.id;
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = {
              name: item.dishName ?? item.DishName ?? 'Plato desconocido',
              quantity: 0,
              revenue: 0
            };
          }
          dishCounts[dishId].quantity += item.quantity ?? 0;
          dishCounts[dishId].revenue += (item.subtotal ?? item.Subtotal ?? item.totalPrice ?? 0);
        });
      });

      const topDishes = Object.values(dishCounts)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(d => ({
          dishName: d.name,
          quantity: d.quantity,
          revenue: d.revenue
        }));

      // Orders by status
      const statusCounts: Record<string, number> = {};
      orders.forEach((o: any) => {
        const status = o.status ?? o.Status ?? '';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count: count as number
      }));

      setReportData({
        totalOrders: orders.length,
        totalRevenue,
        totalCustomers: customers.length,
        totalDishes: dishes.length,
        ordersToday: ordersToday.length,
        revenueToday,
        topDishes,
        ordersByStatus
      });

      const waitersRes = await api.get('/api/reports/waiters');
      const waitersData = waitersRes.data?.waiters ?? waitersRes.data ?? [];
      setWaiterReport(Array.isArray(waitersData) ? waitersData : []);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      if (error?.response?.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        toast.error('Sesión expirada. Inicia sesión de nuevo.');
        window.location.href = 'https://172.31.98.64:3000/login';
        return;
      }
      toast.error('Error al cargar reportes');
      setReportData(emptyReportData());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [dateFilter]);

  if (loading || !reportData) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Cargando reportes...</p>
        </div>
      </MainLayout>
    );
  }

  const STATUS_LABELS: Record<string, string> = {
    'Pending': 'Pendiente',
    'Confirmed': 'Confirmada',
    'Preparing': 'Preparando',
    'Ready': 'Lista',
    'Served': 'Servida',
    'Completed': 'Completada',
    'Cancelled': 'Cancelada'
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reportes y Estadísticas</h1>
            <p className="text-muted-foreground">Análisis de ventas y operaciones</p>
          </div>
          <Button onClick={loadReports} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Main Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Órdenes Totales</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                {reportData.ordersToday} hoy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                RD$ {reportData.totalRevenue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                RD$ {reportData.revenueToday.toLocaleString('es-DO', { minimumFractionDigits: 2 })} hoy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">
                Clientes registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platos en Menú</CardTitle>
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalDishes}</div>
              <p className="text-xs text-muted-foreground">
                Platos disponibles
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Orders by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Órdenes por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reportData.ordersByStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{STATUS_LABELS[item.status] || item.status}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(item.count / reportData.totalOrders) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold w-12 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Dishes */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Platos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.topDishes.map((dish, index) => (
                <div key={dish.dishName} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{dish.dishName}</div>
                    <div className="text-sm text-muted-foreground">
                      {dish.quantity} unidades vendidas
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      RD$ {dish.revenue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground">Ingresos</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reporte de meseros */}
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Meseros</CardTitle>
            <p className="text-sm text-muted-foreground">Ventas y propinas por mesero. Ver detalles para % propina legal y total a pagar.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Mesero</th>
                    <th className="text-right p-2 font-semibold">Ventas</th>
                    <th className="text-right p-2 font-semibold">Propinas</th>
                    <th className="text-right p-2 font-semibold">Transacciones</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {waiterReport.map((w: any) => (
                    <tr key={w.id} className="border-b">
                      <td className="p-2">{w.firstName ?? w.FirstName} {w.lastName ?? w.LastName}</td>
                      <td className="text-right p-2">RD$ {(w.totalSales ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right p-2">RD$ {(w.totalTips ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right p-2">{w.transactionCount ?? 0}</td>
                      <td className="p-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setWaiterDetailId(w.id);
                            try {
                              const res = await api.get(`/api/reports/waiter-detail/${w.id}`);
                              setWaiterDetail(res.data);
                            } catch {
                              setWaiterDetail(null);
                            }
                          }}
                        >
                          Ver detalles
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal detalle mesero: % propina legal y total a pagar */}
        {waiterDetail != null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setWaiterDetail(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-2">Detalle mesero: {waiterDetail.waiterName}</h3>
              <p className="text-sm text-muted-foreground mb-4">Período: {waiterDetail.from && new Date(waiterDetail.from).toLocaleDateString('es-DO')} - {waiterDetail.to && new Date(waiterDetail.to).toLocaleDateString('es-DO')}</p>
              <div className="space-y-3">
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>Ventas totales</span>
                  <span className="font-bold">RD$ {Number(waiterDetail.totalSales ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>10% propina legal (referencia)</span>
                  <span className="font-bold">RD$ {Number(waiterDetail.legalTipTotal ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>% que le toca del 10% legal</span>
                  <span className="font-bold">{Number(waiterDetail.waiterShareOfLegalPercent ?? 0)}%</span>
                </div>
                <div className="flex justify-between p-2 bg-green-100 rounded border border-green-200">
                  <span>Total propina a pagar al mesero</span>
                  <span className="font-bold text-green-800">RD$ {Number(waiterDetail.totalTipToPayToWaiter ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline" onClick={() => setWaiterDetail(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
