'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import { MainLayout } from '@/components/layout/MainLayout';
import { ensureFreshToken } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarCheck,
  RefreshCw,
  XCircle,
  Clock,
  Users,
  Phone,
  MapPin,
  CheckCircle,
  Globe,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as signalR from '@microsoft/signalr';

const api = axios.create({ baseURL: '' });

interface PreOrderItem {
  dishId: number;
  dishName: string;
  quantity: number;
  notes?: string;
  unitPrice: number;
}

interface PreOrder {
  id: number;
  notes?: string;
  items: PreOrderItem[];
}

interface Reservation {
  id: number;
  customerName: string;
  customerPhone: string;
  numberOfGuests: number;
  reservationDateTime: string;
  isConfirmed: boolean;
  tableNumber: number;
  zoneName: string;
  specialRequests?: string;
  source?: string;
  preOrder?: PreOrder | null;
}

export default function ReservationsPage() {
  const t = useTranslations('reservations');
  const dl = dateLocale(useLocale());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/tablereservation');
      setReservations(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error(t('errorLoad'));
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { window.location.href = '/login'; return; }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadReservations();

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/reservations', {

        accessTokenFactory: () => ensureFreshToken(),
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on('NewReservation', (data: any) => {
      toast((toastRef) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{t('newPortalReservation')}</p>
            <p className="text-xs text-gray-500">{data.customerName} · {t('guestsShort', { count: data.numberOfGuests })} · {t('tableShort', { number: data.tableNumber })}</p>
          </div>
          <button onClick={() => toast.dismiss(toastRef.id)} className="px-2 py-1 bg-purple-600 text-white text-xs rounded-lg">OK</button>
        </div>
      ), { duration: 15000, style: { maxWidth: '420px' } });
      loadReservations();
    });

    connection.on('ReservationConfirmed', () => loadReservations());
    connection.on('ReservationCancelled', () => loadReservations());
    connection.start().catch(err => console.warn('SignalR reservations (admin):', err));

    const interval = setInterval(loadReservations, 30000);
    return () => { clearInterval(interval); connection.stop().catch(() => {}); };
  }, []);

  const confirmReservation = async (id: number) => {
    try {
      await api.put(`/api/tablereservation/${id}/confirm`);
      toast.success(t('confirmedSuccess'));
      loadReservations();
    } catch { toast.error(t('errorConfirm')); }
  };

  const cancelReservation = async (id: number) => {
    if (!confirm(t('confirmCancel'))) return;
    try {
      await api.put(`/api/tablereservation/${id}/cancel`);
      toast.success(t('cancelledSuccess'));
      loadReservations();
    } catch { toast.error(t('errorCancel')); }
  };

  const getVal = (obj: any, key: string) =>
    obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)] ?? '';

  const formatTime = (dt: string) => {
    try { return new Date(dt).toLocaleTimeString(dl, { hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return '-'; }
  };

  const formatDate = (dt: string) => {
    try { return new Date(dt).toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'short' }); }
    catch { return '-'; }
  };

  const isUpcoming = (dt: string) => {
    const diff = new Date(dt).getTime() - Date.now();
    return diff > 0 && diff < 2 * 60 * 60 * 1000;
  };

  const reservationsForDate = reservations.filter(r => {
    const dt = getVal(r, 'reservationDateTime');
    if (!dt) return false;
    return new Date(dt).toLocaleDateString('sv-SE') === date;
  });

  const filtered = reservationsForDate.filter(r => {
    if (filter === 'pending') return !getVal(r, 'isConfirmed');
    if (filter === 'confirmed') return !!getVal(r, 'isConfirmed');
    return true;
  });

  const pendingCount = reservationsForDate.filter(r => !getVal(r, 'isConfirmed')).length;
  const confirmedCount = reservationsForDate.filter(r => !!getVal(r, 'isConfirmed')).length;

  return (
    <MainLayout title={t('pageTitle')} subtitle={t('pageSubtitle')}>
      <div className="space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
            <p className="text-muted-foreground">{t('pageSubtitle')}</p>
          </div>
          <Button onClick={loadReservations} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh')}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-blue-500/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{reservationsForDate.length}</div>
              <p className="text-xs text-muted-foreground">{t('statTotal')}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-yellow-400/40">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{confirmedCount}</div>
              <p className="text-xs text-muted-foreground">{t('statConfirmed')}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-green-400/40">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">{t('statPending')}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
              />
              <div className="flex gap-2">
                <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
                  {t('filterAll', { count: reservationsForDate.length })}
                </Button>
                <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>
                  <Clock className="h-4 w-4 mr-1" />
                  {t('filterPending', { count: pendingCount })}
                </Button>
                <Button variant={filter === 'confirmed' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('confirmed')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {t('filterConfirmed', { count: confirmedCount })}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('cardTitle', { date: formatDate(date + 'T12:00:00') })}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <CalendarCheck className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">{t('emptyState')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(reservation => {
                  const confirmed = !!getVal(reservation, 'isConfirmed');
                  const upcoming = isUpcoming(getVal(reservation, 'reservationDateTime'));
                  const preOrder = reservation.preOrder;
                  const isExpanded = expandedId === reservation.id;

                  return (
                    <div
                      key={reservation.id}
                      className={`border-2 rounded-lg transition-all ${
                        upcoming && !confirmed
                          ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20'
                          : confirmed
                          ? 'border-green-300 bg-green-50/50 dark:bg-green-950/10'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-lg font-bold">{getVal(reservation, 'customerName')}</span>
                              {confirmed ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{t('badgeConfirmed')}</Badge>
                              ) : upcoming ? (
                                <Badge className="bg-orange-100 text-orange-700 animate-pulse">{t('badgeUpcoming')}</Badge>
                              ) : (
                                <Badge variant="secondary">{t('badgePending')}</Badge>
                              )}
                              {getVal(reservation, 'source') === 'Portal' && (
                                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  <Globe className="h-3 w-3 mr-1" />Portal
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTime(getVal(reservation, 'reservationDateTime'))}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {t('guests', { count: getVal(reservation, 'numberOfGuests') })}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {t('tableInfo', { number: getVal(reservation, 'tableNumber'), zone: getVal(reservation, 'zoneName') })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {getVal(reservation, 'customerPhone')}
                              </span>
                            </div>
                            {getVal(reservation, 'specialRequests') && (
                              <p className="text-sm mt-2 text-amber-600 dark:text-amber-400">
                                {t('specialNote', { text: getVal(reservation, 'specialRequests') })}
                              </p>
                            )}
                            {preOrder && preOrder.items.length > 0 && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : reservation.id)}
                                className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <UtensilsCrossed className="h-3.5 w-3.5" />
                                {t('preOrderToggle', { count: preOrder.items.length })}
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {!confirmed && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => confirmReservation(reservation.id)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {t('btnAccept')}
                              </Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => cancelReservation(reservation.id)}>
                              <XCircle className="h-4 w-4 mr-1" />
                              {confirmed ? t('btnCancel') : t('btnReject')}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && preOrder && preOrder.items.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-dashed">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('preOrderHeading')}</p>
                            <div className="space-y-1.5">
                              {preOrder.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold">
                                      {item.quantity}
                                    </span>
                                    <span>{item.dishName}</span>
                                    {item.notes && (
                                      <span className="text-xs text-amber-600">— {item.notes}</span>
                                    )}
                                  </span>
                                  <span className="text-muted-foreground font-medium">
                                    ${(item.unitPrice * item.quantity).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              {preOrder.notes && (
                                <p className="text-xs text-muted-foreground mt-2 italic">{t('preOrderNote', { text: preOrder.notes })}</p>
                              )}
                              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                                <span>{t('preOrderTotal')}</span>
                                <span>${preOrder.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
