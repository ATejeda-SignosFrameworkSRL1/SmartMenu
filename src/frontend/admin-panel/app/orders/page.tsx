'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import { MainLayout } from '@/components/layout/MainLayout';
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  TableProperties,
  Hash,
  ChevronRight,
  Loader2,
  Archive,
  ArrowLeft,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '' });

interface Order {
  id: number;
  orderNumber: string;
  tableNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: number;
    dishName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string; badge: string; badgeText: string }> = {
  Pending:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200', dot: 'bg-amber-400',  badge: 'bg-amber-100 border-amber-300',  badgeText: 'text-amber-800' },
  Confirmed: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',  dot: 'bg-blue-400',   badge: 'bg-blue-100 border-blue-300',    badgeText: 'text-blue-800' },
  Preparing: { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',dot: 'bg-violet-400', badge: 'bg-violet-100 border-violet-300', badgeText: 'text-violet-800' },
  Ready:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-400',badge: 'bg-emerald-100 border-emerald-300',badgeText: 'text-emerald-800' },
  Served:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',  dot: 'bg-teal-400',   badge: 'bg-teal-100 border-teal-300',    badgeText: 'text-teal-800' },
  Completed: { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200', dot: 'bg-slate-400',  badge: 'bg-slate-100 border-slate-300',  badgeText: 'text-slate-700' },
  Cancelled: { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',   dot: 'bg-red-400',    badge: 'bg-red-100 border-red-300',      badgeText: 'text-red-800' },
};

const ACCENT: Record<string, string> = {
  Pending: 'bg-amber-400',
  Confirmed: 'bg-blue-500',
  Preparing: 'bg-violet-500',
  Ready: 'bg-emerald-500',
  Served: 'bg-teal-500',
  Completed: 'bg-slate-400',
  Cancelled: 'bg-red-500',
};

const NEXT_STATUS: Record<string, string[]> = {
  Pending:   ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready:     ['Served'],
  Served:    ['Completed'],
  Completed: [],
  Cancelled: [],
};

const NEXT_BTN_STYLE: Record<string, string> = {
  Confirmed: 'bg-blue-600 hover:bg-blue-700 text-white',
  Preparing: 'bg-violet-600 hover:bg-violet-700 text-white',
  Ready:     'bg-emerald-600 hover:bg-emerald-700 text-white',
  Served:    'bg-teal-600 hover:bg-teal-700 text-white',
  Completed: 'bg-slate-600 hover:bg-slate-700 text-white',
  Cancelled: 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-200',
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
}

export default function OrdersPage() {
  const t = useTranslations('orders');
  const dl = dateLocale(useLocale());

  const statusLabel = (key: string) => t(`status.${key}` as any, { defaultValue: key });

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(ticker);
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) { window.location.href = '/login'; return; }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/order/all');
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error(t('toastLoadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const iv = setInterval(loadOrders, 30000);
    return () => clearInterval(iv);
  }, []);

  const updateStatus = async (orderId: number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await api.put(`/api/order/${orderId}/status`, { newStatus });
      toast.success(t('toastStatusUpdated', { label: statusLabel(newStatus) }));
      loadOrders();
    } catch {
      toast.error(t('toastUpdateError'));
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatus = (o: Order) => (o as any).status ?? (o as any).Status ?? '';

  const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served'];
  const ARCHIVED_STATUSES = ['Completed', 'Cancelled'];

  const visibleStatuses = showArchived ? ARCHIVED_STATUSES : ACTIVE_STATUSES;
  const baseOrders = orders.filter(o => visibleStatuses.includes(getStatus(o)));

  const filteredOrders = selectedStatus === 'all'
    ? baseOrders
    : baseOrders.filter(o => getStatus(o) === selectedStatus);

  const statusCounts = visibleStatuses.reduce((acc, s) => {
    acc[s] = orders.filter(o => getStatus(o) === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <MainLayout title={t('pageTitle')}>
      <div className="space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {showArchived ? t('titleArchived') : t('pageTitle')}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t('subtitle', { count: baseOrders.length, mode: showArchived ? t('modeArchived') : t('modeActive') })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowArchived(!showArchived); setSelectedStatus('all'); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium shadow-sm transition ${
                showArchived
                  ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              {showArchived ? <ArrowLeft className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {showArchived ? t('btnViewActive') : t('btnArchived')}
            </button>
            <button
              onClick={loadOrders}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium shadow-sm transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('btnRefresh')}
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">

          <button
            onClick={() => setSelectedStatus('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all shadow-sm
              ${selectedStatus === 'all'
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            {t('tabAll')}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${selectedStatus === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {baseOrders.length}
            </span>
          </button>

          {visibleStatuses.map(status => {
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
            const count = statusCounts[status] || 0;
            const active = selectedStatus === status;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all shadow-sm
                  ${active
                    ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-md`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? cfg.dot : 'bg-gray-300'}`} />
                {statusLabel(status)}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? `${cfg.badge} ${cfg.badgeText}` : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{t('loading')}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <CheckCircle2 className="h-12 w-12 opacity-30" />
            <p className="font-medium">{t('emptyState')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map(order => {
              const status = getStatus(order);
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
              const accent = ACCENT[status] ?? 'bg-gray-400';
              const nextStatuses = NEXT_STATUS[status] ?? [];
              const orderNumber = (order as any).orderNumber ?? (order as any).OrderNumber ?? '';
              const tableNum = (order as any).tableNumber ?? (order as any).TableNumber ?? '–';
              const ft = (order as any).fulfillmentType ?? (order as any).FulfillmentType;
              const createdAt = (order as any).createdAt ?? (order as any).CreatedAt ?? '';
              const total = (order as any).total ?? (order as any).Total ?? 0;
              const items = order.items ?? [];
              const isUpdating = updatingId === order.id;
              const shortCode = (String(orderNumber).split('-').pop() ?? '').toUpperCase();

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                >

                  <div className={`h-1 w-full ${accent}`} />

                  <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">

                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                        <Hash className="w-3 h-3" />
                        <span className="font-semibold text-gray-700">{shortCode}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <TableProperties className="w-4 h-4 text-gray-400" />

                        <span className="text-sm font-semibold text-gray-800">
                          {ft === 'Delivery' ? '🛵 Delivery' : ft === 'Pickup' ? '🛍️ Pickup' : t('table', { number: tableNum })}
                        </span>
                      </div>

                      {createdAt && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo(createdAt)} · {new Date(createdAt).toLocaleTimeString(dl, { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.badge} ${cfg.badgeText}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {statusLabel(status)}
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        RD$ {Number(total).toLocaleString(dl, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="mx-5 border-t border-dashed border-gray-100" />

                  <div className="px-5 py-3 space-y-1.5 flex-1">
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">{t('noItems')}</p>
                    ) : (
                      items.map((item: any, idx: number) => (
                        <div key={item.id ?? item.Id ?? idx} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">
                              {item.quantity ?? item.Quantity}
                            </span>
                            <span className="text-sm text-gray-700 truncate">
                              {item.dishName ?? item.DishName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 font-mono">
                            RD$ {Number(item.subtotal ?? item.Subtotal ?? 0).toLocaleString(dl, { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {nextStatuses.length > 0 && (
                    <div className="mx-5 border-t border-gray-100" />
                  )}

                  {nextStatuses.length > 0 && (
                    <div className="px-5 py-3 flex gap-2 flex-wrap">
                      {isUpdating ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('updating')}
                        </div>
                      ) : (
                        nextStatuses.map(ns => (
                          <button
                            key={ns}
                            onClick={() => updateStatus(order.id, ns)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm
                              ${NEXT_BTN_STYLE[ns] ?? 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                          >
                            {statusLabel(ns)}
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
