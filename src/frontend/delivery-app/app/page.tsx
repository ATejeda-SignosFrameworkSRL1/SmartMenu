'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock, MapPin, Phone, StickyNote, ChevronDown, ChevronUp, PackageCheck, Ban } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslations, useLocale } from 'next-intl';
import { createAuthApi, SessionUser } from '@/lib/auth-client';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import DeliveryMap from '@/components/DeliveryMap';
import { dateLocale } from '@/i18n/config';

// Auth centralizado — mismo factory genérico que el resto de las staff apps.
const { api, logout } = createAuthApi('delivery');

// ── Contrato backend (GET /api/invoices/tracking) ──────────────────────────
interface InvoiceOrderItem {
  dishName: string;
  quantity: number;
}

interface InvoiceOrder {
  orderNumber: string;
  status: string;
  total: number;
  items: InvoiceOrderItem[];
}

type DeliveryStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'ReadyForPickup'
  | 'OutForDelivery'
  | 'Delivered'
  | 'Cancelled';

interface Invoice {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  fulfillmentType: 'Pickup' | 'Delivery';
  deliveryAddress?: string;
  notes?: string;
  total: number;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  orders: InvoiceOrder[];
  // Campos geo (nullable) del contrato /api/invoices/tracking.
  restaurantLat?: number | null; // PUNTO A
  restaurantLng?: number | null;
  driverLat?: number | null; // última posición reportada del repartidor
  driverLng?: number | null;
  driverLocationAt?: string | null;
}

const PREP_STATUSES: DeliveryStatus[] = ['Pending', 'Confirmed', 'Preparing'];

// Estados con traducción en messages/*.json (delivery.status.*). Cualquier otro
// valor del backend se muestra tal cual en vez de renderizar la key cruda.
const KNOWN_STATUSES = new Set<string>([
  'Pending', 'Confirmed', 'Preparing', 'ReadyForPickup', 'OutForDelivery', 'Delivered', 'Cancelled',
]);

export default function DeliveryPage() {
  const t = useTranslations('delivery');
  const locale = useLocale();
  const [user, setUser] = useState<SessionUser | null>(null);
  // Guard de secuencia: loadInvoices se dispara concurrente (poll 10s +
  // acciones manuales); solo la llamada MÁS RECIENTE puede pintar, para que una
  // respuesta lenta/vieja no pise datos frescos. mountedRef evita setState tras unmount.
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingDisabled, setTrackingDisabled] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showPrep, setShowPrep] = useState(false);
  // Mapa: un solo pedido con el mapa abierto a la vez (mantiene el watch de GPS
  // sin ambigüedad y es el foco natural del repartidor).
  const [mapOpenId, setMapOpenId] = useState<number | null>(null);
  const [livePosition, setLivePosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  // Throttle del reporte de GPS al backend: máx ~1 request / 5s.
  const lastReportRef = useRef(0);

  const loadInvoices = useCallback(async () => {
    // Captura el número de secuencia de ESTA llamada; si al volver la respuesta
    // ya entró otra más reciente, se descarta (evita pintar datos viejos sobre frescos).
    const seq = ++seqRef.current;
    const isStale = () => seq !== seqRef.current || !mountedRef.current;
    try {
      const response = await api.get('/api/invoices/tracking');
      const data = response?.data;
      if (isStale()) return;
      if (!Array.isArray(data)) return;
      setTrackingDisabled(false);
      // Solo pedidos a domicilio — Pickup lo maneja el cajero/host.
      setInvoices((data as Invoice[]).filter((inv) => inv.fulfillmentType === 'Delivery'));
    } catch (error: unknown) {
      if (isStale()) return;
      const resp = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
      // Distinguir los DOS 403: el del switch apagado trae body { error: "...deshabilitado..." };
      // el 403 de ROL del [Authorize] (p.ej. token stale de otro rol) viene sin ese texto y
      // NO debe pintarse como "tracking deshabilitado" (UX engañosa).
      if (resp?.status === 403 && /deshabilitad/i.test(resp?.data?.error ?? '')) {
        setTrackingDisabled(true);
        setInvoices([]);
        return;
      }
      console.error('Error loading deliveries:', error);
      // Fallo transitorio (red/timeout/backend reiniciando) u otro 403: CONSERVAR el
      // tablero actual — el próximo poll (10s) reconcilia.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true; // re-armar en re-mount (StrictMode dev ejecuta cleanup+effect dos veces)
    const userData = localStorage.getItem('delivery_user');
    const token = localStorage.getItem('delivery_token');

    if (!userData || !token) {
      window.location.href = '/login';
      return;
    }

    try {
      setUser(JSON.parse(userData) as SessionUser);
    } catch {
      window.location.href = '/login';
      return;
    }

    // Esperar la primera carga antes de quitar el loading — evita el flash del empty state.
    loadInvoices().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    const interval = setInterval(loadInvoices, 10000);
    return () => {
      mountedRef.current = false; // invalida respuestas en vuelo
      clearInterval(interval);
    };
  }, [loadInvoices]);

  // Solo reportamos GPS cuando el pedido con el mapa abierto está EN CAMINO
  // (OutForDelivery). Derivado (no estado) para que el poll de 10s no reinicie
  // el watch: el effect solo se re-ejecuta si CAMBIA este id.
  const openInvoice = mapOpenId != null ? invoices.find((i) => i.id === mapOpenId) : undefined;
  const trackingInvoiceId =
    openInvoice && openInvoice.deliveryStatus === 'OutForDelivery' ? openInvoice.id : null;

  // GPS en vivo del repartidor -> marcador + PUT throttled al backend.
  useEffect(() => {
    if (trackingInvoiceId == null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    // Reset por cada pedido rastreado: primer fix reporta de inmediato.
    setLivePosition(null);
    setGeoDenied(false);
    lastReportRef.current = 0;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLivePosition({ lat, lng }); // (a) mueve el marcador en cada update
        const now = Date.now();
        if (now - lastReportRef.current >= 5000) {
          lastReportRef.current = now;
          // (b) reporta al backend (rol Delivery). Silencioso: el próximo fix reintenta.
          api
            .put(`/api/invoices/${trackingInvoiceId}/driver-location`, { lat, lng })
            .catch(() => {});
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingInvoiceId]);

  const updateStatus = async (invoiceId: number, status: 'OutForDelivery' | 'Delivered') => {
    setUpdatingId(invoiceId);
    try {
      await api.put(`/api/invoices/${invoiceId}/delivery-status`, { status });
      toast.success(status === 'OutForDelivery' ? t('toastPickedUp') : t('toastDelivered'));
      await loadInvoices();
    } catch (error: unknown) {
      const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      toast.error(data?.error || data?.message || t('toastUpdateError'));
    } finally {
      setUpdatingId(null);
    }
  };

  const formatTime = (createdAt: string) => {
    // Asegurar que se interprete como UTC (el servidor devuelve sin 'Z')
    const utcStr = createdAt && !createdAt.endsWith('Z') ? createdAt + 'Z' : createdAt;
    return new Date(utcStr).toLocaleTimeString(dateLocale(locale), {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTotal = (total: number) =>
    `RD$ ${(total ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemCount = (inv: Invoice) =>
    (inv.orders || []).reduce(
      (acc, o) => acc + (o.items || []).reduce((a, i) => a + (i.quantity ?? 0), 0),
      0,
    );

  const statusLabel = (status: string) => (KNOWN_STATUSES.has(status) ? t(`status.${status}`) : status);

  const ready = invoices.filter((i) => i.deliveryStatus === 'ReadyForPickup');
  const enRoute = invoices.filter((i) => i.deliveryStatus === 'OutForDelivery');
  const inPrep = invoices.filter((i) => PREP_STATUSES.includes(i.deliveryStatus));
  const activeCount = ready.length + enRoute.length;

  const renderCard = (inv: Invoice, variant: 'ready' | 'enroute' | 'prep') => {
    const isExpanded = !!expanded[inv.id];
    const isUpdating = updatingId === inv.id;
    const mapOpen = mapOpenId === inv.id;
    const borderClass =
      variant === 'ready' ? 'delivery-ready' : variant === 'enroute' ? 'delivery-enroute' : 'delivery-prep';

    return (
      <div key={inv.id} className={`delivery-card ${borderClass} overflow-hidden`}>
        {/* Header: nº pedido + hora */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <p className="text-xl font-bold text-white">{t('orderNumber', { id: inv.id })}</p>
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock className="w-4 h-4" aria-hidden />
            <span className="text-sm font-medium">{formatTime(inv.createdAt)}</span>
          </div>
        </div>

        {/* Cliente + teléfono */}
        <div className="px-4 pt-2 space-y-1.5">
          <p className="text-lg text-white">👤 {inv.customerName || '—'}</p>
          {inv.customerPhone ? (
            <a
              href={`tel:${inv.customerPhone}`}
              className="inline-flex items-center gap-1.5 text-primary-300 hover:text-primary-200 font-medium underline underline-offset-2"
            >
              <Phone className="w-4 h-4" aria-hidden />
              {inv.customerPhone}
            </a>
          ) : null}
        </div>

        {/* DIRECCIÓN — lo más importante para el repartidor */}
        <div className="mx-4 mt-3 rounded-lg bg-primary-900/40 border border-primary-600 p-3 flex items-start gap-2">
          <MapPin className="w-5 h-5 text-primary-300 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-xs uppercase tracking-wide text-primary-300 font-semibold">{t('address')}</p>
            <p className="text-white font-medium">{inv.deliveryAddress || t('noAddress')}</p>
          </div>
        </div>

        {/* Notas */}
        {inv.notes ? (
          <div className="mx-4 mt-2 rounded-lg bg-amber-900/30 border border-amber-600/50 p-2.5 flex items-start gap-2 text-sm">
            <StickyNote className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" aria-hidden />
            <span className="text-amber-100">{inv.notes}</span>
          </div>
        ) : null}

        {/* Total + toggle de artículos */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 mt-3">
          <p className="text-lg font-bold text-emerald-400">{formatTotal(inv.total)}</p>
          <button
            type="button"
            onClick={() => setExpanded((prev) => ({ ...prev, [inv.id]: !prev[inv.id] }))}
            className="inline-flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors"
          >
            {t('itemsCount', { count: itemCount(inv) })}
            {isExpanded ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
          </button>
        </div>

        {/* Items expandibles */}
        {isExpanded && (
          <div className="mx-4 mt-2 space-y-2">
            {(inv.orders || []).map((order, oIdx) => (
              <div key={order.orderNumber ?? oIdx} className="rounded-lg bg-slate-900/60 border border-slate-700 p-3">
                <p className="text-xs text-gray-400 mb-1.5 font-mono">
                  {order.orderNumber} · {statusLabel(order.status)}
                </p>
                <ul className="space-y-1">
                  {(order.items || []).map((item, iIdx) => (
                    <li key={iIdx} className="text-sm text-gray-200">
                      <span className="font-bold text-primary-300">{item.quantity}x</span> {item.dishName}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Mapa de seguimiento (solo pedidos listos / en camino) */}
        {(variant === 'ready' || variant === 'enroute') && (
          <div className="mx-4 mt-3">
            <button
              type="button"
              onClick={() => setMapOpenId((prev) => (prev === inv.id ? null : inv.id))}
              className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-900/60 hover:bg-slate-700/60 text-sm font-medium text-primary-200 transition-colors"
              aria-expanded={mapOpen}
            >
              {mapOpen ? t('hideMap') : t('viewMap')}
            </button>
            {mapOpen && (
              <div className="mt-3 space-y-2">
                {geoDenied && trackingInvoiceId === inv.id && (
                  <p className="rounded-md bg-amber-900/30 border border-amber-600/50 px-3 py-2 text-xs text-amber-200">
                    ⚠️ {t('geoDenied')}
                  </p>
                )}
                <DeliveryMap invoice={inv} livePosition={livePosition} />
              </div>
            )}
          </div>
        )}

        {/* Acción según estado */}
        <div className="p-4 mt-2 border-t border-slate-700 bg-slate-900/50">
          {variant === 'ready' && (
            <button
              onClick={() => updateStatus(inv.id, 'OutForDelivery')}
              disabled={isUpdating}
              className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-wait text-white font-bold rounded-lg transition-colors"
            >
              {isUpdating ? t('updating') : t('pickUp')}
            </button>
          )}
          {variant === 'enroute' && (
            <button
              onClick={() => updateStatus(inv.id, 'Delivered')}
              disabled={isUpdating}
              className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-wait text-white font-bold rounded-lg transition-colors"
            >
              {isUpdating ? t('updating') : t('markDelivered')}
            </button>
          )}
          {variant === 'prep' && (
            <div className="text-center py-1 text-gray-400 text-sm font-medium">
              {statusLabel(inv.deliveryStatus)}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">{t('title')}</h1>
              <p className="text-gray-400 text-sm mt-1">
                {user?.firstName} {user?.lastName}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-400">{activeCount}</p>
                <p className="text-sm text-gray-400">{t('activeDeliveries')}</p>
              </div>
              <LanguageSwitcher />
              <button
                onClick={logout}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {trackingDisabled ? (
          <div className="text-center py-20">
            <Ban className="w-16 h-16 text-red-400 mx-auto mb-4" aria-hidden />
            <p className="text-2xl text-gray-300 mb-2">{t('trackingDisabled')}</p>
            <p className="text-sm text-gray-500">{t('trackingDisabledHint')}</p>
          </div>
        ) : (
          <>
            {/* Sección: Listos para recoger */}
            <section>
              <h2 className="text-xl font-bold mb-4 text-amber-400">
                {t('readySection')}{' '}
                <span className="ml-1 px-2 py-0.5 rounded-full text-sm bg-amber-900/50 text-amber-200">
                  {ready.length}
                </span>
              </h2>
              {ready.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('emptyReady')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ready.map((inv) => renderCard(inv, 'ready'))}
                </div>
              )}
            </section>

            {/* Sección: En camino */}
            <section>
              <h2 className="text-xl font-bold mb-4 text-primary-400">
                {t('enRouteSection')}{' '}
                <span className="ml-1 px-2 py-0.5 rounded-full text-sm bg-primary-900/50 text-primary-200">
                  {enRoute.length}
                </span>
              </h2>
              {enRoute.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('emptyEnRoute')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enRoute.map((inv) => renderCard(inv, 'enroute'))}
                </div>
              )}
            </section>

            {/* Empty state global */}
            {activeCount === 0 && inPrep.length === 0 && (
              <div className="text-center py-10">
                <PackageCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" aria-hidden />
                <p className="text-xl text-gray-400">{t('emptyAll')}</p>
              </div>
            )}

            {/* Sección opcional (colapsada): En preparación — solo lectura */}
            {inPrep.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowPrep((v) => !v)}
                  className="inline-flex items-center gap-2 text-xl font-bold text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {t('prepSection')}
                  <span className="px-2 py-0.5 rounded-full text-sm bg-slate-800 text-gray-300">{inPrep.length}</span>
                  {showPrep ? <ChevronUp className="w-5 h-5" aria-hidden /> : <ChevronDown className="w-5 h-5" aria-hidden />}
                </button>
                {showPrep && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                    {inPrep.map((inv) => renderCard(inv, 'prep'))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
