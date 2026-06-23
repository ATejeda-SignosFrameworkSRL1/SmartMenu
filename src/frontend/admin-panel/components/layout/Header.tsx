'use client';

import { Bell, Clock, AlertCircle, ShoppingBag, Calendar, X, ChefHat, MapPin, Pin, CheckCircle2, XCircle, Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { useAdminNotifications, TableClaimNotification } from '@/lib/useAdminNotifications';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const api = axios.create({ baseURL: '' });

interface Notification {
  id: string;
  type: 'urgent' | 'order' | 'reservation' | 'kitchen' | 'table' | 'claim';
  title: string;
  description: string;
  time: string;
  read: boolean;
  // Solo para tipo 'claim'
  claimData?: TableClaimNotification;
}

function getElapsedMinutes(createdAt: string): number {
  const utcStr = createdAt && !createdAt.endsWith('Z') ? createdAt + 'Z' : createdAt;
  return Math.floor((Date.now() - new Date(utcStr).getTime()) / 60000);
}

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const t = useTranslations('header');
  const dl = dateLocale(useLocale());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // Ref sincronizado con readIds para que fetchNotifications siempre use el valor actual
  // (evita el stale closure del setInterval que crea notificaciones siempre como no leídas)
  const readIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { readIdsRef.current = readIds; }, [readIds]);
  const panelRef = useRef<HTMLDivElement>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Cargar token del admin desde localStorage (solo en cliente)
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const userData = localStorage.getItem('admin_user');
    if (token) setAdminToken(token);
    if (userData) { try { setAdminUser(JSON.parse(userData)); } catch {} }
  }, []);

  // SignalR para solicitudes de mesa en tiempo real
  const { claimRequests, markRead: markClaimRead, removeRequest } = useAdminNotifications(adminToken);

  // Convertir un claim en notificación
  const buildClaimNotif = (cr: TableClaimNotification): Notification => ({
    id: cr.id,
    type: 'claim' as const,
    title: t('claimTitle', { tableNumber: cr.tableNumber }),
    description: t('claimDescription', { waiterName: cr.waiterName }),
    time: cr.timestamp instanceof Date
      ? cr.timestamp.toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })
      : new Date(cr.timestamp).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' }),
    read: cr.read,
    claimData: cr,
  });

  // Cuando llega una nueva solicitud de claim vía SignalR, agregarla a las notificaciones
  const prevClaimLenRef = useRef(0);
  useEffect(() => {
    if (claimRequests.length > prevClaimLenRef.current) {
      setNotifications(prev => {
        const withoutClaims = prev.filter(n => n.type !== 'claim');
        const claimNotifs = claimRequests.map(buildClaimNotif);
        return [...claimNotifs, ...withoutClaims];
      });
      setShowPanel(true);
    }
    prevClaimLenRef.current = claimRequests.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimRequests]);

  // Mantener claims sincronizados con cambios de estado (read, removed)
  useEffect(() => {
    setNotifications(prev => {
      const withoutClaims = prev.filter(n => n.type !== 'claim');
      const claimNotifs = claimRequests.map(buildClaimNotif);
      return [...claimNotifs, ...withoutClaims];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimRequests.length]);

  // ── Polling de respaldo: cada 10s consulta solicitudes pendientes ──────────
  // Garantiza que el admin vea claims aunque SignalR no esté conectado.
  useEffect(() => {
    const pollPending = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        const res = await api.get('/api/tableclaim/pending', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list: any[] = Array.isArray(res.data) ? res.data : [];
        if (list.length === 0) return;

        setNotifications(prev => {
          const existingClaimRequestIds = new Set(
            prev.filter(n => n.type === 'claim' && n.claimData).map(n => n.claimData!.requestId)
          );
          const newOnes = list.filter(r => !existingClaimRequestIds.has(r.id));
          if (newOnes.length === 0) return prev;

          const newNotifs: Notification[] = newOnes.map(r => ({
            id: `claim-poll-${r.id}`,
            type: 'claim' as const,
            title: t('claimTitle', { tableNumber: r.tableNumber }),
            description: t('claimDescription', { waiterName: r.waiterName }),
            time: new Date(r.createdAt).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' }),
            read: false,
            claimData: {
              id: `claim-poll-${r.id}`,
              requestId: r.id,
              waiterId: r.waiterId,
              waiterName: r.waiterName,
              tableId: r.tableId,
              tableNumber: r.tableNumber,
              orderId: r.orderId,
              message: t('claimMessage', { waiterName: r.waiterName, tableNumber: r.tableNumber }),
              timestamp: new Date(r.createdAt),
              read: false,
            },
          }));

          setShowPanel(true);
          return [...newNotifs, ...prev.filter(n => n.type !== 'claim' || !newOnes.some(r => `claim-poll-${r.id}` === n.id))];
        });
      } catch {
        // silencioso — el polling es un respaldo
      }
    };

    pollPending(); // ejecutar inmediatamente al montar
    const interval = setInterval(pollPending, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const [ordersRes, reservationsRes, tablesRes] = await Promise.all([
        api.get('/api/order/active').catch(() => ({ data: [] })),
        api.get('/api/tablereservation').catch(() => ({ data: [] })),
        api.get('/api/table').catch(() => ({ data: [] })),
      ]);

      const notifs: Notification[] = [];
      const status = (o: any) => o?.status ?? o?.Status ?? '';

      // ── PEDIDOS ──
      const orders: any[] = Array.isArray(ordersRes.data) ? ordersRes.data : [];

      const pending = orders.filter(o => status(o) === 'Pending');
      if (pending.length > 0) {
        notifs.push({
          id: 'pending-orders',
          type: 'order',
          title: t('pendingOrdersTitle', { count: pending.length }),
          description: t('pendingOrdersDescription'),
          time: t('timeNow'),
          read: readIdsRef.current.has('pending-orders'),
        });
      }

      const cooking = orders.filter(o => ['Confirmed', 'Preparing'].includes(status(o)));
      const urgent = cooking.filter(o => {
        const ca = o.createdAt ?? o.CreatedAt ?? '';
        return ca && getElapsedMinutes(ca) > 15;
      });
      if (urgent.length > 0) {
        const minElapsed = Math.min(...urgent.map(o => getElapsedMinutes(o.createdAt ?? o.CreatedAt ?? '')));
        notifs.push({
          id: 'urgent-kitchen',
          type: 'urgent',
          title: t('urgentOrdersTitle', { count: urgent.length }),
          description: t('urgentOrdersDescription'),
          time: t('timeAgoMin', { min: minElapsed }),
          read: readIdsRef.current.has('urgent-kitchen'),
        });
      }

      const ready = orders.filter(o => {
        const kr = o.kitchenReady ?? o.KitchenReady;
        const br = o.barReady ?? o.BarReady;
        const ks = o.kitchenServed ?? o.KitchenServed;
        return (kr || br) && !ks;
      });
      if (ready.length > 0) {
        notifs.push({
          id: 'ready-orders',
          type: 'kitchen',
          title: t('readyOrdersTitle', { count: ready.length }),
          description: t('readyOrdersDescription'),
          time: t('timeNow'),
          read: readIdsRef.current.has('ready-orders'),
        });
      }

      // ── MESAS ──
      const tables: any[] = Array.isArray(tablesRes.data) ? tablesRes.data : [];
      const occupiedTables = tables.filter(tbl => (tbl.status ?? tbl.Status) === 'Occupied');
      if (occupiedTables.length > 0) {
        notifs.push({
          id: 'occupied-tables',
          type: 'table',
          title: t('occupiedTablesTitle', { count: occupiedTables.length }),
          description: occupiedTables.slice(0, 3).map(tbl => `Mesa #${tbl.tableNumber ?? tbl.TableNumber}`).join(', ') + (occupiedTables.length > 3 ? '…' : ''),
          time: t('timeOngoing'),
          read: readIdsRef.current.has('occupied-tables'),
        });
      }

      const reservedTables = tables.filter(tbl => (tbl.status ?? tbl.Status) === 'Reserved');
      if (reservedTables.length > 0) {
        notifs.push({
          id: 'reserved-tables',
          type: 'table',
          title: t('reservedTablesTitle', { count: reservedTables.length }),
          description: reservedTables.slice(0, 3).map(tbl => `Mesa #${tbl.tableNumber ?? tbl.TableNumber}`).join(', ') + (reservedTables.length > 3 ? '…' : ''),
          time: t('timeToday'),
          read: readIdsRef.current.has('reserved-tables'),
        });
      }

      // ── RESERVAS SIN CONFIRMAR ──
      const reservations: any[] = Array.isArray(reservationsRes.data) ? reservationsRes.data : [];
      const todayLocal = new Date().toLocaleDateString('sv-SE');
      const pendingRes = reservations.filter(r => {
        const confirmed = r.isConfirmed ?? r.IsConfirmed;
        const dt = r.reservationDateTime ?? r.ReservationDateTime ?? '';
        const dayLocal = dt ? new Date(dt).toLocaleDateString('sv-SE') : '';
        return !confirmed && dayLocal === todayLocal;
      });
      if (pendingRes.length > 0) {
        notifs.push({
          id: 'pending-reservations',
          type: 'reservation',
          title: t('pendingReservationsTitle', { count: pendingRes.length }),
          description: t('pendingReservationsDescription'),
          time: t('timeToday'),
          read: readIdsRef.current.has('pending-reservations'),
        });
      }

      // Mantener los claims al inicio
      setNotifications(prev => {
        const existingClaims = prev.filter(n => n.type === 'claim');
        return [...existingClaims, ...notifs];
      });
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const ids = new Set(notifications.map(n => n.id));
    setReadIds(ids);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markOneRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Aprobar solicitud de mesa
  const handleApproveClaim = async (notif: Notification) => {
    if (!notif.claimData) return;
    setRespondingId(notif.id);
    try {
      const token = localStorage.getItem('admin_token');
      const adminId = adminUser?.id ?? adminUser?.Id ?? 0;
      await api.put(
        `/api/tableclaim/${notif.claimData.requestId}/approve`,
        { adminId, note: null },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      markClaimRead(notif.id);
      removeRequest(notif.id);
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? t('errorApprove');
      alert(msg);
    } finally {
      setRespondingId(null);
    }
  };

  // Rechazar solicitud de mesa
  const handleRejectClaim = async (notif: Notification) => {
    if (!notif.claimData) return;
    setRespondingId(notif.id);
    try {
      const token = localStorage.getItem('admin_token');
      const adminId = adminUser?.id ?? adminUser?.Id ?? 0;
      await api.put(
        `/api/tableclaim/${notif.claimData.requestId}/reject`,
        { adminId, note: null },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      markClaimRead(notif.id);
      removeRequest(notif.id);
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? t('errorReject');
      alert(msg);
    } finally {
      setRespondingId(null);
    }
  };

  const ICON_MAP: Record<string, JSX.Element> = {
    urgent: <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />,
    order: <ShoppingBag className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />,
    reservation: <Calendar className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />,
    kitchen: <ChefHat className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />,
    table: <MapPin className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />,
    claim: <Pin className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />,
  };

  const DARK_RED = '#8a0000e6';

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <SidebarTrigger className="h-9 w-9" />

      <div className="flex-1">
        <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span className="font-medium">
          {currentTime.toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="hidden md:inline">
          {currentTime.toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      <LanguageSwitcher />

      {/* Bell + Panel */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => {
            setShowPanel(p => {
              if (!p) {
                setTimeout(() => {
                  setReadIds(prev => new Set([...prev, ...notifications.map(n => n.id)]));
                  setNotifications(all => all.map(n => ({ ...n, read: true })));
                }, 2000);
              }
              return !p;
            });
          }}
          className="relative flex h-9 w-9 items-center justify-center rounded-md transition-colors"
          style={{ color: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = DARK_RED)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>

        {showPanel && (
          <div className="absolute right-0 top-12 w-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-border z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-sm">{t('panelTitle')}</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">{t('unreadCount', { count: unreadCount })}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground"
                    onClick={markAllRead}
                  >
                    {t('markAllRead')}
                  </button>
                )}
                <button
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setShowPanel(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">{t('emptyState')}</p>
                  <p className="text-xs mt-1">{t('emptyStateSubtitle')}</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={cn(
                      'border-b border-border last:border-0 transition-colors',
                      notif.type === 'claim'
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                        : !notif.read
                          ? 'bg-blue-50/50 dark:bg-blue-950/20'
                          : ''
                    )}
                  >
                    {notif.type === 'claim' && notif.claimData ? (
                      /* ── Solicitud de mesa — con botones de acción ── */
                      <div className="px-4 py-3">
                        <div className="flex gap-3 mb-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0 mt-0.5">
                            <Users className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                              {t('claimCardTitle', { tableNumber: notif.claimData.tableNumber })}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              <span className="font-medium">{notif.claimData.waiterName}</span> {t('claimCardDescription')}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{notif.time}</p>
                          </div>
                          {!notif.read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />}
                        </div>
                        <div className="flex gap-2 ml-11">
                          <button
                            onClick={() => handleApproveClaim(notif)}
                            disabled={respondingId === notif.id}
                            className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
                          >
                            {respondingId === notif.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle2 className="h-3 w-3" />
                            }
                            {t('approve')}
                          </button>
                          <button
                            onClick={() => handleRejectClaim(notif)}
                            disabled={respondingId === notif.id}
                            className="flex-1 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
                          >
                            <XCircle className="h-3 w-3" />
                            {t('reject')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Notificación estándar ── */
                      <div
                        onClick={() => markOneRead(notif.id)}
                        className={cn(
                          'flex gap-3 px-4 py-3 cursor-pointer',
                          !notif.read ? 'hover:bg-blue-100/70 dark:hover:bg-blue-950/40' : 'hover:bg-muted/50'
                        )}
                      >
                        {ICON_MAP[notif.type]}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm leading-tight', !notif.read && 'font-semibold')}>{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{notif.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{notif.time}</span>
                          {!notif.read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <button
                className="text-xs text-primary hover:underline w-full text-center"
                onClick={() => { setShowPanel(false); window.location.href = '/orders'; }}
              >
                {t('viewAllOrders')}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
