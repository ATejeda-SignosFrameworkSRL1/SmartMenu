'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
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
  Award,
  BarChart2,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  LabelList,
} from 'recharts';

const api = axios.create({ baseURL: '' });

interface ReportData {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalDishes: number;
  ordersToday: number;
  revenueToday: number;
  topDishes: Array<{ dishName: string; quantity: number; revenue: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
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

const STATUS_KEYS: Record<string, string> = {
  Pending: 'statusPending',
  Confirmed: 'statusConfirmed',
  Preparing: 'statusPreparing',
  Ready: 'statusReady',
  Served: 'statusServed',
  Completed: 'statusCompleted',
  Cancelled: 'statusCancelled',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Confirmed: '#3b82f6',
  Preparing: '#8b5cf6',
  Ready: '#06b6d4',
  Served: '#10b981',
  Completed: '#22c55e',
  Cancelled: '#ef4444',
};

const DISH_COLORS = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#0891b2'];

const formatRD = (v: number) =>
  `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`;

const CustomTooltipRevenue = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {formatRD(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomTooltipCount = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const t = useTranslations('reports');
  const dl = dateLocale(useLocale());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [waiterReport, setWaiterReport] = useState<WaiterReportRow[]>([]);
  const [waiterDetail, setWaiterDetail] = useState<any>(null);

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
        window.location.href = '/login';
        return;
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const [ordersRes, dishesRes, customersRes] = await Promise.all([
        api.get('/api/order/all'),
        api.get('/api/dish', { params: { all: true } }),
        api.get('/api/user'),
      ]);

      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data?.data ?? []);
      const dishes = Array.isArray(dishesRes.data) ? dishesRes.data : (dishesRes.data?.data ?? []);
      const customersRaw = Array.isArray(customersRes.data) ? customersRes.data : (customersRes.data?.data ?? []);
      const customers = customersRaw.filter((u: any) => (u.role || u.Role) === 'Customer');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ordersToday = orders.filter((o: any) => new Date(o.createdAt ?? o.CreatedAt ?? 0) >= today);

      const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total ?? o.totalAmount ?? 0), 0);
      const revenueToday = ordersToday.reduce((s: number, o: any) => s + (o.total ?? o.totalAmount ?? 0), 0);

      const dishCounts: Record<number, { name: string; quantity: number; revenue: number }> = {};
      orders.forEach((order: any) => {
        order.items?.forEach((item: any) => {
          const dishId = item.dishId ?? item.DishId ?? item.id;
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = { name: item.dishName ?? item.DishName ?? t('unknownDish'), quantity: 0, revenue: 0 };
          }
          dishCounts[dishId].quantity += item.quantity ?? 0;
          dishCounts[dishId].revenue += item.subtotal ?? item.Subtotal ?? item.totalPrice ?? 0;
        });
      });

      const topDishes = Object.values(dishCounts)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(d => ({ dishName: d.name, quantity: d.quantity, revenue: d.revenue }));

      const statusCounts: Record<string, number> = {};
      orders.forEach((o: any) => {
        const status = o.status ?? o.Status ?? '';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count: count as number,
      }));

      setReportData({ totalOrders: orders.length, totalRevenue, totalCustomers: customers.length, totalDishes: dishes.length, ordersToday: ordersToday.length, revenueToday, topDishes, ordersByStatus });

      const waitersRes = await api.get('/api/reports/waiters');
      const waitersData = waitersRes.data?.waiters ?? waitersRes.data ?? [];
      setWaiterReport(Array.isArray(waitersData) ? waitersData : []);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      if (error?.response?.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        toast.error(t('sessionExpired'));
        window.location.href = '/login';
        return;
      }
      toast.error(t('errorLoading'));
      setReportData(emptyReportData());
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadReports(); }, []);

  if (loading || !reportData) {
    return (
      <MainLayout title={t('pageTitle')}>
        <div className="flex flex-col items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">{t('loadingReports')}</p>
        </div>
      </MainLayout>
    );
  }

  // Derived data for charts
  const statusChartData = reportData.ordersByStatus.map(item => ({
    name: STATUS_KEYS[item.status] ? t(STATUS_KEYS[item.status]) : item.status,
    value: item.count,
    fill: STATUS_COLORS[item.status] || '#94a3b8',
  }));

  const topDishesBarData = reportData.topDishes.map(d => ({
    name: d.dishName.length > 14 ? d.dishName.slice(0, 14) + '…' : d.dishName,
    fullName: d.dishName,
    cantidad: d.quantity,
    ingresos: d.revenue,
  }));

  const waiterChartData = waiterReport.map((w: any) => ({
    name: `${w.firstName ?? w.FirstName} ${(w.lastName ?? w.LastName ?? '').charAt(0)}.`,
    ventas: w.totalSales ?? 0,
    propinas: w.totalTips ?? 0,
    transacciones: w.transactionCount ?? 0,
  }));

  const totalStatusOrders = statusChartData.reduce((s, i) => s + i.value, 0);

  return (
    <MainLayout title={t('pageTitle')}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
            <p className="text-muted-foreground">{t('pageSubtitle')}</p>
          </div>
          <Button onClick={loadReports} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh')}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpiTotalOrders')}</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalOrders}</div>
              <p className="text-xs text-muted-foreground">{t('kpiToday', { count: reportData.ordersToday })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpiTotalRevenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                RD$ {reportData.totalRevenue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('kpiRevToday', { amount: `RD$ ${reportData.revenueToday.toLocaleString('es-DO', { minimumFractionDigits: 2 })}` })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpiCustomers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">{t('kpiCustomersRegistered')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpiDishesOnMenu')}</CardTitle>
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalDishes}</div>
              <p className="text-xs text-muted-foreground">{t('kpiDishesAvailable')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Row 1: Pie chart + Bar chart top dishes */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Pie — Órdenes por Estado */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              <CardTitle>{t('chartOrdersByStatus')}</CardTitle>
            </CardHeader>
            <CardContent>
              {statusChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">{t('noData')}</p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} ${t('orders')} (${((value / totalStatusOrders) * 100).toFixed(1)}%)`,
                          name,
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Mini stats row */}
                  <div className="w-full grid grid-cols-2 gap-2">
                    {statusChartData.map(item => (
                      <div key={item.name} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                        <span className="text-xs font-medium flex-1 truncate">{item.name}</span>
                        <span className="text-xs font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Horizontal Bar — Top 5 por cantidad */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle>{t('chartTop5Units')}</CardTitle>
            </CardHeader>
            <CardContent>
              {topDishesBarData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">{t('noData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={topDishesBarData}
                    layout="vertical"
                    margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                              <p className="font-semibold mb-1">{d.fullName}</p>
                              <p className="text-primary">{d.cantidad} {t('units')}</p>
                              <p className="text-green-600">{formatRD(d.ingresos)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="cantidad" radius={[0, 6, 6, 0]}>
                      {topDishesBarData.map((_, i) => (
                        <Cell key={i} fill={DISH_COLORS[i % DISH_COLORS.length]} />
                      ))}
                      <LabelList dataKey="cantidad" position="right" style={{ fontSize: 12, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Top dishes revenue bar + Waiter radar */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Vertical Bar — Top 5 por ingresos */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>{t('chartTop5Revenue')}</CardTitle>
            </CardHeader>
            <CardContent>
              {topDishesBarData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">{t('noData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topDishesBarData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `RD$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltipRevenue />} />
                    <Bar dataKey="ingresos" name={t('revenue')} radius={[6, 6, 0, 0]}>
                      {topDishesBarData.map((_, i) => (
                        <Cell key={i} fill={DISH_COLORS[i % DISH_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Radar — Rendimiento meseros */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>{t('chartWaiterPerformance')}</CardTitle>
            </CardHeader>
            <CardContent>
              {waiterChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">{t('noDataWaiters')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={waiterChartData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <Radar name={t('transactions')} dataKey="transacciones" stroke="#dc2626" fill="#dc2626" fillOpacity={0.25} />
                    <Radar name={t('salesK')} dataKey="ventas" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2}
                      dot={{ r: 3 }}
                    />
                    <Legend />
                    <Tooltip content={<CustomTooltipCount />} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Waiter grouped bar */}
        {waiterChartData.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle>{t('chartWaiterSalesTips')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={waiterChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `RD$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltipRevenue />} />
                  <Legend />
                  <Bar dataKey="ventas" name={t('sales')} fill="#dc2626" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="propinas" name={t('tips')} fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Waiter Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('tableWaiterReportTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('tableWaiterReportSubtitle')}</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">{t('colWaiter')}</th>
                    <th className="text-right p-2 font-semibold">{t('sales')}</th>
                    <th className="text-right p-2 font-semibold">{t('tips')}</th>
                    <th className="text-right p-2 font-semibold">{t('transactions')}</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {waiterReport.map((w: any) => (
                    <tr key={w.id} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="p-2 font-medium">{w.firstName ?? w.FirstName} {w.lastName ?? w.LastName}</td>
                      <td className="text-right p-2">RD$ {(w.totalSales ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right p-2 text-orange-600 font-medium">RD$ {(w.totalTips ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right p-2">{w.transactionCount ?? 0}</td>
                      <td className="p-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const res = await api.get(`/api/reports/waiter-detail/${w.id}`);
                              setWaiterDetail(res.data);
                            } catch {
                              setWaiterDetail(null);
                            }
                          }}
                        >
                          {t('viewDetails')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal detalle mesero */}
        {waiterDetail != null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setWaiterDetail(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-2">{t('modalDetailTitle', { name: waiterDetail.waiterName })}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('modalPeriod', {
                  from: waiterDetail.from ? new Date(waiterDetail.from).toLocaleDateString(dl) : '',
                  to: waiterDetail.to ? new Date(waiterDetail.to).toLocaleDateString(dl) : '',
                })}
              </p>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-muted rounded-lg">
                  <span>{t('modalTotalSales')}</span>
                  <span className="font-bold">RD$ {Number(waiterDetail.totalSales ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-lg">
                  <span>{t('modalLegalTip')}</span>
                  <span className="font-bold">RD$ {Number(waiterDetail.legalTipTotal ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-lg">
                  <span>{t('modalWaiterShare')}</span>
                  <span className="font-bold">{Number(waiterDetail.waiterShareOfLegalPercent ?? 0)}%</span>
                </div>
                <div className="flex justify-between p-3 bg-green-100 rounded-lg border border-green-200">
                  <span>{t('modalTipToPay')}</span>
                  <span className="font-bold text-green-800">RD$ {Number(waiterDetail.totalTipToPayToWaiter ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline" onClick={() => setWaiterDetail(null)}>{t('close')}</Button>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
