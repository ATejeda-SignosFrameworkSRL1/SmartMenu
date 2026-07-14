'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/lib/api';
import {
  RefreshCw,
  Loader2,
  Truck,
  PackageX,
  ChevronDown,
  ChevronRight,
  Phone,
  MapPin,
  Store,
  Package,
  ArrowRight,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import toast from 'react-hot-toast';

// ── Tipos del contrato de /api/invoices ──────────────────────────────────────
interface InvoiceOrderItem {
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}
interface InvoiceOrder {
  orderId: number;
  orderNumber: string;
  restaurantId: number;
  restaurantName: string;
  status: string;
  kitchenReady: boolean;
  barReady: boolean;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items: InvoiceOrderItem[];
}
interface Invoice {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillmentType: 'Delivery' | 'Pickup';
  deliveryAddress: string;
  notes: string;
  subTotal: number;
  taxITBIS: number;
  legalTip: number;
  total: number;
  paymentStatus: string;
  deliveryStatus: string;
  createdAt: string;
  orders: InvoiceOrder[];
}

// Orden lógico del flujo de delivery + colores del Badge por estado.
const DELIVERY_STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'ReadyForPickup',
  'OutForDelivery',
  'Delivered',
  'Cancelled',
] as const;
type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

const STATUS_CONFIG: Record<string, { badge: string; badgeText: string; dot: string; accent: string }> = {
  Pending:        { badge: 'bg-amber-100 border-amber-300',   badgeText: 'text-amber-800',   dot: 'bg-amber-400',   accent: 'bg-amber-400' },
  Confirmed:      { badge: 'bg-blue-100 border-blue-300',      badgeText: 'text-blue-800',    dot: 'bg-blue-400',    accent: 'bg-blue-500' },
  Preparing:      { badge: 'bg-violet-100 border-violet-300',  badgeText: 'text-violet-800',  dot: 'bg-violet-400',  accent: 'bg-violet-500' },
  ReadyForPickup: { badge: 'bg-cyan-100 border-cyan-300',      badgeText: 'text-cyan-800',    dot: 'bg-cyan-400',    accent: 'bg-cyan-500' },
  OutForDelivery: { badge: 'bg-indigo-100 border-indigo-300',  badgeText: 'text-indigo-800',  dot: 'bg-indigo-400',  accent: 'bg-indigo-500' },
  Delivered:      { badge: 'bg-emerald-100 border-emerald-300',badgeText: 'text-emerald-800', dot: 'bg-emerald-400', accent: 'bg-emerald-500' },
  Cancelled:      { badge: 'bg-red-100 border-red-300',        badgeText: 'text-red-800',     dot: 'bg-red-400',     accent: 'bg-red-500' },
};

// Siguiente(s) estado(s) a los que se puede avanzar desde el actual.
const NEXT_STATUS: Record<string, DeliveryStatus[]> = {
  Pending:        ['Confirmed', 'Cancelled'],
  Confirmed:      ['Preparing', 'Cancelled'],
  Preparing:      ['ReadyForPickup', 'Cancelled'],
  ReadyForPickup: ['OutForDelivery', 'Delivered'],
  OutForDelivery: ['Delivered'],
  Delivered:      [],
  Cancelled:      [],
};

const POLL_MS = 15000;

export default function DeliveryPage() {
  const t = useTranslations('delivery');
  const dl = dateLocale(useLocale());

  const statusLabel = (key: string) => t(`status.${key}` as any, { defaultValue: key });

  const [enabled, setEnabled] = useState<boolean | null>(null); // null = aún no cargado
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabledByBackend, setDisabledByBackend] = useState(false); // 403 del GET tracking
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // ── Ajustes de tracking (GET/PUT /api/invoices/tracking-settings) ──────────
  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/invoices/tracking-settings');
      setEnabled(Boolean(res.data?.deliveryTrackingEnabled));
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Mismo patrón que el switch de visibilidad del plano: optimista + PUT.
  const onToggleEnabled = async (next: boolean) => {
    setTogglingEnabled(true);
    setEnabled(next); // optimista
    try {
      const res = await api.put('/invoices/tracking-settings', { enabled: next });
      const confirmed = Boolean(res.data?.deliveryTrackingEnabled);
      setEnabled(confirmed);
      if (confirmed) setDisabledByBackend(false);
      toast.success(confirmed ? t('toast.enabled') : t('toast.disabled'));
    } catch {
      setEnabled(!next); // revertir
      toast.error(t('toast.settingsError'));
    } finally {
      setTogglingEnabled(false);
    }
  };

  // ── Facturas en seguimiento (GET /api/invoices/tracking?status=) ───────────
  const loadInvoices = useCallback(async () => {
    if (enabled !== true) return;
    try {
      const params = selectedStatus === 'all' ? undefined : { status: selectedStatus };
      const res = await api.get('/invoices/tracking', { params });
      setInvoices(Array.isArray(res.data) ? res.data : []);
      setDisabledByBackend(false);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setDisabledByBackend(true);
        setInvoices([]);
      } else {
        toast.error(t('toast.loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, selectedStatus, t]);

  // Carga + polling de respaldo (~15s), solo cuando el tracking está habilitado.
  useEffect(() => {
    if (enabled !== true) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadInvoices();
    const iv = setInterval(loadInvoices, POLL_MS);
    return () => clearInterval(iv);
  }, [enabled, loadInvoices]);

  const advanceStatus = async (invoiceId: number, newStatus: DeliveryStatus) => {
    setUpdatingId(invoiceId);
    try {
      await api.put(`/invoices/${invoiceId}/delivery-status`, { status: newStatus });
      toast.success(t('toast.statusUpdated', { label: statusLabel(newStatus) }));
      await loadInvoices();
    } catch {
      toast.error(t('toast.updateError'));
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const money = (n: number) =>
    `RD$ ${Number(n ?? 0).toLocaleString(dl, { minimumFractionDigits: 2 })}`;

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.badge} ${cfg.badgeText}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {statusLabel(status)}
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const showList = enabled === true && !disabledByBackend;

  return (
    <MainLayout title={t('pageTitle')} subtitle={t('pageSubtitle')}>
      <div className="space-y-6">

        {/* ── Header + switch (siempre visible) ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{t('pageSubtitle')}</p>
          </div>
          {showList && (
            <button
              onClick={() => loadInvoices()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium shadow-sm transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
          )}
        </div>

        {/* ── Toggle de habilitación (mismo patrón que el switch del plano) ── */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">{t('toggleLabel')}</p>
              <p className="text-xs text-muted-foreground">
                {enabled === true ? t('toggleHintOn') : t('toggleHintOff')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {togglingEnabled && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={enabled === true}
              disabled={enabled === null || togglingEnabled}
              onCheckedChange={onToggleEnabled}
              aria-label={t('toggleLabel')}
            />
          </div>
        </div>

        {/* ── Estados de la vista ── */}
        {enabled === null ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{t('loading')}</p>
          </div>
        ) : enabled === false || disabledByBackend ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
            <PackageX className="h-12 w-12 opacity-30" />
            <p className="font-medium text-gray-600">{t('disabledTitle')}</p>
            <p className="text-sm max-w-md text-center">{t('disabledSubtitle')}</p>
          </div>
        ) : (
          <>
            {/* ── Filtro por estado ── */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-600">{t('filterLabel')}</span>
              <div className="w-56">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('filterAll')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filterAll')}</SelectItem>
                    {DELIVERY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Lista de facturas ── */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">{t('loading')}</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <Package className="h-12 w-12 opacity-30" />
                <p className="font-medium">{t('emptyState')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const cfg = STATUS_CONFIG[inv.deliveryStatus] ?? STATUS_CONFIG.Pending;
                  const nextStatuses = NEXT_STATUS[inv.deliveryStatus] ?? [];
                  const isUpdating = updatingId === inv.id;
                  const isOpen = expanded.has(inv.id);

                  return (
                    <div
                      key={inv.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                      {/* Accent strip */}
                      <div className={`h-1 w-full ${cfg.accent}`} />

                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          {/* Info principal */}
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-gray-900 truncate">
                                {inv.customerName || t('noCustomer')}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                inv.fulfillmentType === 'Delivery'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-teal-50 text-teal-700 border-teal-200'
                              }`}>
                                {inv.fulfillmentType === 'Delivery' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                                {t(`fulfillment.${inv.fulfillmentType}` as any, { defaultValue: inv.fulfillmentType })}
                              </span>
                            </div>

                            <div className="flex flex-col gap-1 text-sm text-gray-500">
                              {inv.customerPhone && (
                                <span className="flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                                  {inv.customerPhone}
                                </span>
                              )}
                              {inv.fulfillmentType === 'Delivery' && inv.deliveryAddress && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                  {inv.deliveryAddress}
                                </span>
                              )}
                              {inv.createdAt && (
                                <span className="text-xs text-gray-400">
                                  {new Date(inv.createdAt).toLocaleString(dl, {
                                    day: '2-digit', month: 'short',
                                    hour: 'numeric', minute: '2-digit', hour12: true,
                                  })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Estado + total */}
                          <div className="flex flex-col items-end gap-2">
                            <StatusBadge status={inv.deliveryStatus} />
                            <span className="text-xl font-bold text-gray-900">{money(inv.total)}</span>
                          </div>
                        </div>

                        {/* Acciones de avance de estado */}
                        {nextStatuses.length > 0 && (
                          <div className="mt-4 flex items-center gap-2 flex-wrap">
                            {isUpdating ? (
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('updating')}
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-medium text-gray-500">{t('advanceLabel')}</span>
                                {nextStatuses.map((ns) => {
                                  const nsCfg = STATUS_CONFIG[ns] ?? STATUS_CONFIG.Pending;
                                  return (
                                    <button
                                      key={ns}
                                      onClick={() => advanceStatus(inv.id, ns)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm hover:opacity-90 ${nsCfg.badge} ${nsCfg.badgeText}`}
                                    >
                                      {statusLabel(ns)}
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        )}

                        {/* Toggle de órdenes por franquicia */}
                        {inv.orders?.length > 0 && (
                          <button
                            onClick={() => toggleExpand(inv.id)}
                            className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
                          >
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            {t('ordersCount', { count: inv.orders.length })}
                          </button>
                        )}

                        {/* Órdenes por franquicia */}
                        {isOpen && inv.orders?.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-dashed border-gray-100 pt-3">
                            {inv.orders.map((o) => (
                              <div key={o.orderId} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Store className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-gray-800 truncate">
                                      {o.restaurantName || t('noRestaurant')}
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">#{o.orderNumber}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={o.status} />
                                    <span className="text-sm font-bold text-gray-900">{money(o.total)}</span>
                                  </div>
                                </div>

                                {o.items?.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {o.items.map((it, idx) => (
                                      <div key={`${o.orderId}-${it.dishId}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white border border-gray-200 text-gray-600 font-bold flex items-center justify-center text-[10px]">
                                            {it.quantity}
                                          </span>
                                          <span className="text-gray-600 truncate">{it.dishName}</span>
                                        </div>
                                        <span className="text-gray-400 font-mono flex-shrink-0">{money(it.subtotal)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
