'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Users, Calendar, LogOut, X, Clock, Phone, Mail, User, CreditCard, CheckCircle, XCircle, CalendarCheck, Globe, UtensilsCrossed, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import * as signalR from '@microsoft/signalr';
import { createAuthApi, ensureFreshToken } from '@/lib/auth-client';
import HostReservationWizard from '@/components/HostReservationWizard';
import dynamic from 'next/dynamic';
import { useHostFloorPlan } from '@/lib/useHostFloorPlan';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const { api } = createAuthApi('host');

const MultiZoneFloorPlanViewer = dynamic(
  () => import('@smartmenu/ui').then((m) => ({ default: m.MultiZoneFloorPlanViewer })),
  { ssr: false, loading: () => <p className="p-6 text-sm text-gray-500 animate-pulse">Cargando plano…</p> }
);

interface Zone {
  id: number;
  name: string;
  tableCount: number;
  availableTables: number;
  type?: string;
}

interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: string;
  qrCode: string;
  zoneId: number;
  zoneName: string;
}

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
  customerEmail?: string;
  confirmationCode?: string;
  numberOfGuests: number;
  reservationDateTime: string;
  isConfirmed: boolean;
  isCancelled?: boolean;
  status?: string;
  assignedTableIds?: number[];
  tableNumber: number | null;
  tableId: number | null;
  zoneName: string | null;
  requestedZoneId?: number | null;
  requestedZoneName?: string | null;
  isZoneExclusive?: boolean;
  specialRequests?: string;
  occasionType?: number;
  source?: string;
  advanceBlockMinutes?: number;
  preOrder?: PreOrder | null;
}

const TERMINAL_RESERVATION_STATUS = new Set(['Cancelled', 'Completed', 'NoShow', 'Expired']);

const OCCASION_LABELS: Record<number, { label: string; icon: string; color: string }> = {
  0: { label: 'Casual', icon: '', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  1: { label: 'Cumpleaños', icon: '🎂', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  2: { label: 'Aniversario', icon: '💐', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  3: { label: 'Negocios', icon: '💼', color: 'bg-slate-200 text-slate-700 border-slate-300' },
  4: { label: 'Romántica', icon: '❤️', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  5: { label: 'Familiar', icon: '👨‍👩‍👧', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  99: { label: 'Otra', icon: '✨', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

interface AssignableTable {
  id: number;
  tableNumber: number;
  capacity: number;
  zoneName: string;
  isOccupied: boolean;
  isCurrent: boolean;
}

interface TableAvailability {
  tableId: number;
  tableNumber: number;
  zoneName: string;
  capacity: number;
  freeSlots: string[];
}
interface TablesAvailabilityResponse {
  date: string;
  slotMinutes: number;
  tables: TableAvailability[];
}

export default function HostApp() {
  const t = useTranslations();
  const dl = dateLocale(useLocale());
  const [user, setUser] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [tableReservasModal, setTableReservasModal] = useState<{ table: Table } | null>(null);
  const [occTableDate, setOccTableDate] = useState<string>('');
  const [occTableMonth, setOccTableMonth] = useState<Date>(() => new Date());
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const [activeView, setActiveView] = useState<'tables' | 'reservations' | 'calendar'>('tables');
  const { data: floorPlanData, palette: floorPlanPalette, enabled: floorPlanEnabled } = useHostFloorPlan();
  const [showPlan, setShowPlan] = useState(false);
  const [planoSel, setPlanoSel] = useState<string | number | null>(null);
  const [planoTable, setPlanoTable] = useState<Table | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationFilter, setReservationFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingAlert, setPendingAlert] = useState(0);
  const [expandedReservationId, setExpandedReservationId] = useState<number | null>(null);

  const [rescheduleModalForReservation, setRescheduleModalForReservation] = useState<Reservation | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);

  const [calendarDaySelected, setCalendarDaySelected] = useState<string | null>(null);

  const [dayModalOccasionFilter, setDayModalOccasionFilter] = useState<number | 'all'>('all');

  useEffect(() => { setDayModalOccasionFilter('all'); }, [calendarDaySelected]);

  const [assignModalForReservation, setAssignModalForReservation] = useState<Reservation | null>(null);
  const [contactReservation, setContactReservation] = useState<Reservation | null>(null);
  const [assignableTables, setAssignableTables] = useState<AssignableTable[]>([]);
  const [loadingAssignable, setLoadingAssignable] = useState(false);
  const [assigningTableId, setAssigningTableId] = useState<number | null>(null);

  const [assignableZoneId, setAssignableZoneId] = useState<number | null>(null);
  const [allZonesForAssign, setAllZonesForAssign] = useState<Zone[]>([]);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCapacity, setFilterCapacity] = useState<string>('all');

  const [filterTime, setFilterTime] = useState<'any' | 'today' | 'tomorrow' | 'week' | 'custom'>('any');
  const [filterTimeFrom, setFilterTimeFrom] = useState<string>('');
  const [filterTimeTo, setFilterTimeTo] = useState<string>('');

  const [tableSlots, setTableSlots] = useState<Record<number, string[]>>({});
  const [tableSlotsLoading, setTableSlotsLoading] = useState(false);

  const [openSlotsTableId, setOpenSlotsTableId] = useState<number | null>(null);

  const [numberOfGuests, setNumberOfGuests] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  const [menuDishes, setMenuDishes] = useState<any[]>([]);

  const n = (obj: any, key: string) => obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)];

  const loadData = async () => {
    try {
      const token = localStorage.getItem('host_token');
      if (!token) return;

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const [zonesRes, tablesRes] = await Promise.all([
        api.get('/api/zone'),
        api.get('/api/table')
      ]);

      const allZones: Zone[] = (zonesRes.data ?? []).map((z: any) => ({
        id: n(z, 'id'),
        name: n(z, 'name') ?? '',
        tableCount: n(z, 'tableCount') ?? 0,
        availableTables: n(z, 'availableTables') ?? 0,
        type: n(z, 'type') ?? '',
      }));

      const diningZones = allZones.filter(
        z => !z.type || (z.type.toLowerCase() !== 'kitchen' && z.type.toLowerCase() !== 'bar')
      );
      setZones(diningZones);

      const diningZoneNames = new Set(diningZones.map(z => z.name));

      const tablesData = (tablesRes.data ?? [])
        .map((t: any) => ({
          id: n(t, 'id'),
          tableNumber: n(t, 'tableNumber'),
          capacity: n(t, 'capacity'),
          status: n(t, 'status') ?? 'Available',
          qrCode: n(t, 'qrCode') ?? '',
          zoneName: n(t, 'zoneName') ?? 'Sin zona',
          zoneId: n(t, 'zoneId'),
        }))
        .filter((t: any) => diningZoneNames.has(t.zoneName));

      setTables(tablesData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      const msg = error?.response?.data?.error || error?.message || t('toast.loadError');
      toast.error(msg);
      setZones([]);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReservations = useCallback(async () => {
    try {
      const res = await api.get('/api/tablereservation');
      const data: Reservation[] = Array.isArray(res.data) ? res.data : [];
      setReservations(data);
    } catch {
      console.error('Error loading reservations');
    }
  }, []);

  const assignableReqSeqRef = useRef(0);

  const loadAssignableTables = async (reservationId: number, zoneId: number | null) => {
    const seq = ++assignableReqSeqRef.current;
    setLoadingAssignable(true);
    try {
      const url = zoneId
        ? `/api/tablereservation/${reservationId}/available-tables?zoneId=${zoneId}`
        : `/api/tablereservation/${reservationId}/available-tables`;
      const res = await api.get(url);
      if (seq !== assignableReqSeqRef.current) return;
      setAssignableTables(Array.isArray(res.data) ? res.data : []);
    } catch {
      if (seq !== assignableReqSeqRef.current) return;
      toast.error(t('toast.availableTablesError'));
      setAssignableTables([]);
    } finally {
      if (seq === assignableReqSeqRef.current) setLoadingAssignable(false);
    }
  };

  const openReservationAssignModal = async (r: Reservation) => {
    setAssignModalForReservation(r);
    setAssignableTables([]);

    const initialZone = r.requestedZoneId ?? null;
    setAssignableZoneId(initialZone);

    if (allZonesForAssign.length === 0) {
      try {
        const res = await api.get('/api/zone');
        const list = Array.isArray(res.data) ? res.data : [];
        const dining = list
          .map((z: any) => ({
            id: Number(z.id ?? z.Id),
            name: String(z.name ?? z.Name ?? ''),
            tableCount: Number(z.tableCount ?? z.TableCount ?? 0),
            availableTables: Number(z.availableTables ?? z.AvailableTables ?? 0),
            type: String(z.type ?? z.Type ?? ''),
          }))
          .filter((z: any) => !z.type || (z.type.toLowerCase() !== 'kitchen' && z.type.toLowerCase() !== 'bar'));
        setAllZonesForAssign(dining);
      } catch {  }
    }
    await loadAssignableTables(r.id, initialZone);
  };

  const changeAssignableZone = async (zoneId: number) => {
    if (!assignModalForReservation) return;
    setAssignableZoneId(zoneId);
    await loadAssignableTables(assignModalForReservation.id, zoneId);
  };

  const closeReservationAssignModal = () => {
    setAssignModalForReservation(null);
    setAssignableTables([]);
    setAssigningTableId(null);
    setAssignableZoneId(null);
  };

  const assignTableToReservation = async (tableId: number) => {
    if (!assignModalForReservation) return;
    const reservation = assignModalForReservation;
    setAssigningTableId(tableId);
    try {

      await api.put(`/api/tablereservation/${reservation.id}/assign-table`, { tableId });

      if (!reservation.isConfirmed) {
        await api.put(`/api/tablereservation/${reservation.id}/confirm`);
        toast.success(t('toast.reservationAccepted'));
      } else {
        toast.success(t('toast.tableReassigned'));
      }
      closeReservationAssignModal();
      loadReservations();
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.error || t('toast.assignError');
      toast.error(msg);
    } finally {
      setAssigningTableId(null);
    }
  };

  const openRescheduleModal = (r: Reservation) => {
    const dt = new Date(r.reservationDateTime);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    setRescheduleDate(`${y}-${m}-${d}`);
    setRescheduleTime(`${hh}:${mm}`);
    setRescheduleModalForReservation(r);
  };

  const closeRescheduleModal = () => {
    setRescheduleModalForReservation(null);
    setRescheduleDate('');
    setRescheduleTime('');
  };

  const submitReschedule = async (reservationOverride?: Reservation, targetDateTime?: string) => {
    const r = reservationOverride ?? rescheduleModalForReservation;
    if (!r) return;
    const newDateTime = targetDateTime ?? `${rescheduleDate}T${rescheduleTime}:00`;
    if (!newDateTime || newDateTime.startsWith('T')) {
      toast.error(t('reschedule.requiredError'));
      return;
    }
    setRescheduling(true);
    try {
      const res = await api.put(`/api/tablereservation/${r.id}/reschedule`, { newDateTime });
      const data = res.data;
      if (data?.hasConflict && data?.warning) {
        toast(data.warning, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(t('toast.rescheduled'));
      }
      closeRescheduleModal();
      setCalendarDaySelected(null);
      loadReservations();
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.error || t('toast.rescheduleError');
      toast.error(msg);
    } finally {
      setRescheduling(false);
    }
  };

  const [cancelConfirmReservation, setCancelConfirmReservation] = useState<Reservation | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState(false);

  const [zoneDecisionModal, setZoneDecisionModal] = useState<{ r: Reservation; accept: boolean } | null>(null);
  const [zoneDecisionMsg, setZoneDecisionMsg] = useState('');
  const [zoneDeciding, setZoneDeciding] = useState(false);

  const requestCancelReservation = (r: Reservation) => {
    setCancelConfirmReservation(r);
  };

  const confirmCancelReservation = async () => {
    if (!cancelConfirmReservation) return;
    setCancellingReservation(true);
    try {
      await api.put(`/api/tablereservation/${cancelConfirmReservation.id}/cancel`);
      toast.success(cancelConfirmReservation.isConfirmed ? t('toast.reservationCancelled') : t('toast.reservationRejected'));
      setCancelConfirmReservation(null);
      loadReservations();
      loadData();
    } catch {
      toast.error(t('toast.cancelError'));
    } finally {
      setCancellingReservation(false);
    }
  };

  const openZoneDecision = (r: Reservation, accept: boolean) => {
    setZoneDecisionMsg(accept ? t('zoneDecision.defaultAcceptMsg') : '');
    setZoneDecisionModal({ r, accept });
  };

  const submitZoneDecision = async () => {
    if (!zoneDecisionModal) return;
    const { r, accept } = zoneDecisionModal;
    setZoneDeciding(true);
    try {
      await api.post(`/api/tablereservation/${r.id}/zone-decision`, { accept, message: zoneDecisionMsg });
      toast.success(accept ? t('toast.zoneReserved') : t('toast.zoneRejected'));
      setZoneDecisionModal(null);
      setZoneDecisionMsg('');
      loadReservations();
      loadData();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error(t('toast.zoneConflict'));
      } else {
        toast.error(t('toast.zoneDecisionError'));
      }
    } finally {
      setZoneDeciding(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('host_token');
    if (!token) return;

    const hubUrl = '/hubs/reservations';

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {

        accessTokenFactory: () => ensureFreshToken('host'),
        skipNegotiation: false,

        transport: signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('NewReservation', (data: any) => {
      toast((toastInstance) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{t('signalR.newReservationTitle')}</p>
            <p className="text-xs text-gray-500">{data.customerName} · {t('common.persons', { count: data.numberOfGuests })} · Mesa {data.tableNumber}</p>
          </div>
          <button onClick={() => { toast.dismiss(toastInstance.id); setActiveView('reservations'); }} className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg font-semibold hover:bg-purple-700">
            {t('signalR.view')}
          </button>
        </div>
      ), { duration: 15000, style: { maxWidth: '420px' } });

      setPendingAlert(prev => prev + 1);
      loadReservations();

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(t('signalR.newReservationTitle'), {
          body: `${data.customerName} — ${t('common.persons', { count: data.numberOfGuests })}`,
          icon: '/favicon.ico',
        });
      }
    });

    connection.on('ReservationConfirmed', () => loadReservations());
    connection.on('ReservationCancelled', () => loadReservations());

    connection.on('AvailabilityChanged', () => loadReservations());

    connection.start().then(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }).catch(err => console.warn('SignalR reservations connection failed:', err));

    return () => {
      connection.stop().catch(() => {});
    };
  }, [loadReservations]);

  useEffect(() => {

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');

    if (tokenFromUrl && userFromUrl) {
      localStorage.setItem('host_token', tokenFromUrl);
      localStorage.setItem('host_user', decodeURIComponent(userFromUrl));
      window.history.replaceState({}, '', '/');
    }

    const userData = localStorage.getItem('host_user');
    const token = localStorage.getItem('host_token');

    if (!userData || !token) {
      window.location.href = '/login';
      return;
    }

    setUser(JSON.parse(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    loadData();
    loadReservations();

    const interval = setInterval(loadData, 30000);
    const reservInterval = setInterval(loadReservations, 30000);
    return () => { clearInterval(interval); clearInterval(reservInterval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotsDay = useMemo<string>(() => {
    const now = new Date();
    const fmt = (d: Date) => d.toLocaleDateString('sv-SE');
    if (filterTime === 'tomorrow') {
      return fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    }
    if (filterTime === 'custom' && filterTimeFrom) {
      return filterTimeFrom;
    }

    return fmt(now);
  }, [filterTime, filterTimeFrom]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setTableSlotsLoading(true);
      try {
        const res = await api.get(`/api/tablereservation/availability/tables?date=${slotsDay}`);
        const data = res.data as TablesAvailabilityResponse;
        const map: Record<number, string[]> = {};
        for (const t of (Array.isArray(data?.tables) ? data.tables : [])) {
          if (typeof t?.tableId === 'number') {
            map[t.tableId] = Array.isArray(t.freeSlots) ? t.freeSlots : [];
          }
        }
        if (!cancelled) setTableSlots(map);
      } catch {

        if (!cancelled) setTableSlots({});
      } finally {
        if (!cancelled) setTableSlotsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [slotsDay]);

  const openAssignModal = (table: Table) => {
    if (table.status !== 'Available') {
      toast.error(t('toast.tableNotAvailable'));
      return;
    }
    setSelectedTable(table);
    setNumberOfGuests('');
    setSpecialNotes('');
    setShowAssignModal(true);
  };

  const assignTable = async () => {
    if (!selectedTable || !numberOfGuests) {
      toast.error(t('toast.fillAllFields'));
      return;
    }

    try {
      await api.post('/api/tablesession', {
        tableId: selectedTable.id,
        numberOfGuests: parseInt(numberOfGuests),
        hostId: user?.id,
        specialNotes
      });

      toast.success(t('toast.tableAssigned'));
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      toast.error(t('toast.tableAssignError'));
    }
  };

  const openReservationModal = (table: Table) => {
    setSelectedTable(table);
    setShowReservationModal(true);

    if (menuDishes.length === 0) {
      api.get('/api/dish')
        .then(res => setMenuDishes(Array.isArray(res.data) ? res.data : []))
        .catch(() => { toast.error(t('toast.menuLoadError')); });
    }
  };

  const getStatusStrip = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-emerald-500';
      case 'Occupied': return 'bg-red-500';
      case 'Reserved': return 'bg-amber-400';
      case 'Billing': return 'bg-violet-500';
      case 'Cleaning': return 'bg-blue-400';
      default: return 'bg-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case 'Occupied': return 'bg-red-50 text-red-700 ring-1 ring-red-200';
      case 'Reserved': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'Billing': return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200';
      case 'Cleaning': return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
      default: return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Available': return t('status.available');
      case 'Occupied': return t('status.occupied');
      case 'Reserved': return t('status.reserved');
      case 'Billing': return t('status.billing');
      case 'Cleaning': return t('status.cleaning');
      default: return status;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('host_token');
    localStorage.removeItem('host_user');
    window.location.href = '/login';
  };

  const timeRange = useMemo<{ from: Date; to: Date } | null>(() => {
    if (filterTime === 'any') return null;
    const now = new Date();
    if (filterTime === 'today') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { from, to };
    }
    if (filterTime === 'tomorrow') {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const from = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0);
      const to = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);
      return { from, to };
    }
    if (filterTime === 'week') {

      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
      return { from, to };
    }
    if (filterTime === 'custom' && filterTimeFrom && filterTimeTo) {
      return { from: new Date(filterTimeFrom + 'T00:00:00'), to: new Date(filterTimeTo + 'T23:59:59') };
    }
    return null;
  }, [filterTime, filterTimeFrom, filterTimeTo]);

  const reservationsByTableInRange = useMemo<Map<number, Reservation[]>>(() => {
    const map = new Map<number, Reservation[]>();
    if (!timeRange) return map;
    for (const r of reservations) {
      if (r.isCancelled) continue;
      if (!r.tableId) continue;
      const dt = new Date(r.reservationDateTime);
      if (dt >= timeRange.from && dt <= timeRange.to) {
        const arr = map.get(r.tableId) ?? [];
        arr.push(r);
        map.set(r.tableId, arr);
      }
    }
    return map;
  }, [reservations, timeRange]);

  const filteredTables = useMemo(() => {
    const selectedZoneName = selectedZone ? zones.find(z => z.id === selectedZone)?.name : null;
    return tables.filter(t => {
      const zoneMatch = !selectedZoneName || t.zoneName === selectedZoneName;
      const statusMatch = filterStatus === 'all' || t.status === filterStatus;
      const capacityMatch =
        filterCapacity === 'all' ||
        (filterCapacity === '2' && t.capacity <= 2) ||
        (filterCapacity === '4' && t.capacity >= 3 && t.capacity <= 4) ||
        (filterCapacity === '6+' && t.capacity >= 5);

      const timeMatch = !timeRange || (reservationsByTableInRange.get(t.id)?.length ?? 0) > 0;
      return zoneMatch && statusMatch && capacityMatch && timeMatch;
    });
  }, [tables, selectedZone, zones, filterStatus, filterCapacity, timeRange, reservationsByTableInRange]);

  const reservationCountByZone = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    if (!timeRange) return map;
    for (const [tid, arr] of reservationsByTableInRange.entries()) {
      const t = tables.find(tb => tb.id === tid);
      if (!t) continue;
      map.set(t.zoneName, (map.get(t.zoneName) ?? 0) + arr.length);
    }
    return map;
  }, [reservationsByTableInRange, tables, timeRange]);

  const hasActiveFilters = filterStatus !== 'all' || filterCapacity !== 'all' || filterTime !== 'any';

  const clearFilters = () => {
    setSelectedZone(null);
    setFilterStatus('all');
    setFilterCapacity('all');
    setFilterTime('any');
    setFilterTimeFrom('');
    setFilterTimeTo('');
  };

  const availableSeats = tables.filter(t => t.status === 'Available').reduce((sum, t) => sum + t.capacity, 0);

  const activeReservations = reservations.filter(
    (r) => !r.isCancelled && !TERMINAL_RESERVATION_STATUS.has(r.status || '')
  );

  const today = new Date().toLocaleDateString('sv-SE');
  const todayReservations = activeReservations.filter(r => {
    const dt = r.reservationDateTime;
    if (!dt) return false;
    return new Date(dt).toLocaleDateString('sv-SE') === today;
  });
  const pendingReservations = todayReservations.filter(r => !r.isConfirmed);
  const confirmedReservations = todayReservations.filter(r => r.isConfirmed);

  const statusFiltered = reservationFilter === 'pending'
    ? activeReservations.filter(r => !r.isConfirmed)
    : reservationFilter === 'confirmed'
    ? activeReservations.filter(r => r.isConfirmed)
    : activeReservations;

  const dateFiltered = (!dateFrom && !dateTo)
    ? statusFiltered
    : statusFiltered.filter(r => {
        const dKey = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
        if (dateFrom && dKey < dateFrom) return false;
        if (dateTo && dKey > dateTo) return false;
        return true;
      });

  const q = searchQuery.trim().toLowerCase();
  const allFiltered = !q
    ? dateFiltered
    : dateFiltered.filter(r => {
        const haystack = `${r.customerName || ''} ${r.customerPhone || ''} ${r.customerEmail || ''}`.toLowerCase();
        return haystack.includes(q);
      });

  const hasActiveReservationFilters = !!dateFrom || !!dateTo || !!q || reservationFilter !== 'all';

  const birthdayCount = allFiltered.filter(r => r.occasionType === 1).length;
  const specialOccasionsCount = allFiltered.filter(r => r.occasionType && r.occasionType !== 0).length;

  const groupedByDate = allFiltered.reduce<Record<string, Reservation[]>>((acc, r) => {
    const key = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  Object.keys(groupedByDate).forEach(key => {
    groupedByDate[key].sort((a, b) => {
      const sa = a.isCancelled ? 2 : (a.isConfirmed ? 1 : 0);
      const sb = b.isCancelled ? 2 : (b.isConfirmed ? 1 : 0);
      if (sa !== sb) return sa - sb;
      return new Date(a.reservationDateTime).getTime() - new Date(b.reservationDateTime).getTime();
    });
  });
  const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => {

    if (reservationFilter === 'pending') return a.localeCompare(b);

    const ra = a === today ? 0 : (a > today ? 1 : 2);
    const rb = b === today ? 0 : (b > today ? 1 : 2);
    if (ra !== rb) return ra - rb;
    return ra === 2 ? b.localeCompare(a) : a.localeCompare(b);
  });

  const totalPending = activeReservations.filter(r => !r.isConfirmed).length;

  const occupancyForTableOnDate = (table: Table, ymd: string) =>
    reservations
      .filter(r => {
        const occupies = r.tableId === table.id || (r.assignedTableIds || []).includes(table.id);
        const st = r.status || (r.isConfirmed ? 'Confirmed' : (r.isCancelled ? 'Cancelled' : 'Pending'));
        const active = st === 'Confirmed' || st === 'Seated';
        const sameDay = (r.reservationDateTime || '').slice(0, 10) === ymd;
        return occupies && active && sameDay;
      })
      .sort((a, b) => (a.reservationDateTime || '').localeCompare(b.reservationDateTime || ''));
  const openTableOccupancy = (table: Table) => {
    const t = new Date();
    const ymd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    setOccTableDate(ymd);
    setOccTableMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    setTableReservasModal({ table });
  };
  const to12h = (t?: string | null): string => {
    if (!t) return '';
    const [hs, m = '00'] = String(t).split(':');
    let h = parseInt(hs, 10);
    if (Number.isNaN(h)) return String(t);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.padStart(2, '0')} ${ap}`;
  };
  const formatReservationTime = (dt: string) => {
    try { return new Date(dt).toLocaleTimeString(dl, { hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return '-'; }
  };

  const formatDateHeader = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  };

  const isPastDate = (dateStr: string) => dateStr < today;

  if (loading || !mounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-slate-400">{t('loading.tables')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="bg-slate-900 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">{t('header.title')}</h1>
                <p className="text-sm text-slate-400">
                  {t('header.welcome', { name: user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : (user?.name ?? user?.email ?? '') })}
                </p>
              </div>

              <div className="flex rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <button
                  onClick={() => setActiveView('tables')}
                  className={`px-5 py-2 text-sm font-semibold transition-all ${
                    activeView === 'tables'
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t('tabs.tables')}
                </button>
                <button
                  onClick={() => { setActiveView('reservations'); setPendingAlert(0); }}
                  className={`relative px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${
                    activeView === 'reservations'
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  {t('tabs.reservations')}
                  {pendingAlert > 0 && activeView !== 'reservations' && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                      {pendingAlert}
                    </span>
                  )}
                  {totalPending > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-bold">
                      {totalPending}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveView('calendar')}
                  className={`px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${
                    activeView === 'calendar'
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  {t('tabs.calendar')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all border border-white/10"
              >
                <LogOut className="w-4 h-4" />
                {t('header.logout')}
              </button>
            </div>
          </div>

          <div className="hidden md:flex flex-wrap items-center justify-center gap-2 mt-4">
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(tb => tb.status === 'Available').length}</p>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mt-0.5">{t('stats.free')}</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(tb => tb.status === 'Occupied').length}</p>
                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mt-0.5">{t('stats.occupied')}</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(tb => tb.status === 'Billing').length}</p>
                  <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mt-0.5">{t('stats.billing')}</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(tb => tb.status === 'Reserved').length}</p>
                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mt-0.5">{t('stats.reserved')}</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{availableSeats}</p>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{t('stats.freeSeats')}</p>
                </div>
          </div>
        </div>
      </div>

      {activeView === 'calendar' && (
        <CalendarView
          reservations={reservations}
          onDayClick={(dateKey) => setCalendarDaySelected(dateKey)}
        />
      )}

      {activeView === 'reservations' && (
        <div className="max-w-5xl mx-auto px-6 pt-5 pb-10">

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center border-l-4 border-l-slate-400">
              <p className="text-3xl font-black text-slate-700">{todayReservations.length}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">{t('reservations.totalToday')}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center border-l-4 border-l-amber-400">
              <p className="text-3xl font-black text-slate-700">{pendingReservations.length}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">{t('reservations.pendingToday')}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center border-l-4 border-l-emerald-400">
              <p className="text-3xl font-black text-slate-700">{confirmedReservations.length}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">{t('reservations.confirmedToday')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-5">
            {([
              { key: 'all', label: t('reservations.filterAll') },
              { key: 'pending', label: t('reservations.filterPending') },
              { key: 'confirmed', label: t('reservations.filterConfirmed') },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setReservationFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  reservationFilter === f.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2 flex-wrap">

              <div className={`relative flex items-center transition-all ${
                searchQuery ? 'ring-2 ring-blue-200 rounded-xl' : ''
              }`}>
                <Search className={`absolute left-3 w-4 h-4 pointer-events-none ${
                  searchQuery ? 'text-blue-500' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('reservations.searchPlaceholder')}
                  aria-label={t('reservations.searchAriaLabel')}
                  className={`pl-9 pr-8 py-2 w-56 rounded-xl text-sm font-medium border transition-all focus:outline-none focus:border-blue-500 ${
                    searchQuery
                      ? 'bg-blue-50 text-blue-900 border-blue-300 placeholder:text-blue-300'
                      : 'bg-white text-slate-600 border-gray-200 hover:border-gray-300 placeholder:text-slate-400'
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-red-600 transition-colors p-1"
                    aria-label={t('reservations.clearSearch')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 border transition-all ${
                (dateFrom || dateTo) ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 'bg-white border-gray-200'
              }`}>
                <Calendar className={`w-4 h-4 ${(dateFrom || dateTo) ? 'text-blue-500' : 'text-slate-400'}`} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label={t('reservations.dateFrom')}
                  title={t('reservations.dateFrom')}
                  className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                />
                <span className={`text-xs font-bold ${(dateFrom || dateTo) ? 'text-blue-500' : 'text-slate-400'}`}>→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  aria-label={t('reservations.dateTo')}
                  title={t('reservations.dateTo')}
                  className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-slate-400 hover:text-red-600 transition-colors p-0.5"
                    aria-label={t('reservations.clearDateRange')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {birthdayCount > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm"
                  title={t('reservations.birthdayBadge', { count: birthdayCount })}
                >
                  <span className="text-base leading-none">🎂</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{birthdayCount}</span>
                  <span className="text-xs font-medium text-slate-500">
                    {t('reservations.birthdayBadge', { count: birthdayCount })}
                  </span>
                </div>
              )}
              {specialOccasionsCount > birthdayCount && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm"
                >
                  <span className="text-base leading-none">✨</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{specialOccasionsCount - birthdayCount}</span>
                  <span className="text-xs font-medium text-slate-500">
                    {t('reservations.occasionBadge', { count: specialOccasionsCount - birthdayCount })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {sortedDateKeys.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              {hasActiveReservationFilters ? (
                <>
                  <Search className="w-14 h-14 text-blue-200 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-slate-700">{t('reservations.noResultsTitle')}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {t('reservations.noResultsDesc')}
                  </p>
                  <button
                    onClick={() => {
                      setReservationFilter('all');
                      setDateFrom('');
                      setDateTo('');
                      setSearchQuery('');
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {t('common.clearAllFilters')}
                  </button>
                </>
              ) : (
                <>
                  <Inbox className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-slate-600">{t('reservations.emptyTitle')}</p>
                  <p className="text-sm text-slate-400 mt-1">
                    {t('reservations.emptyDesc')}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDateKeys.map(dateKey => (
                <div key={dateKey}>

                  <div className={`flex items-center gap-3 mb-3 px-1 ${isPastDate(dateKey) ? 'opacity-60' : ''}`}>
                    <CalendarCheck className={`w-4 h-4 ${dateKey === today ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold capitalize ${dateKey === today ? 'text-blue-600' : 'text-slate-600'}`}>
                      {dateKey === today ? t('reservations.todayPrefix') : ''}{formatDateHeader(dateKey)}
                    </span>
                    <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                      {t('reservations.groupCount', { count: groupedByDate[dateKey].length })}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {groupedByDate[dateKey].map(r => {
                      const isPending = !r.isConfirmed;
                      const isPortal = r.source === 'Portal';
                      const isUpcoming = new Date(r.reservationDateTime).getTime() - Date.now() < 2 * 3600000 && new Date(r.reservationDateTime).getTime() > Date.now();
                      const isExpanded = expandedReservationId === r.id;
                      const preOrder = r.preOrder;

                      return (
                        <div
                          key={r.id}
                          className={`bg-white rounded-2xl shadow-sm border transition-all ${
                            isPending
                              ? 'border-slate-200 border-l-4 border-l-amber-400'
                              : isUpcoming
                              ? 'border-slate-200 border-l-4 border-l-emerald-400'
                              : 'border-gray-100'
                          }`}
                        >
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="text-lg font-bold text-slate-900">{r.customerName}</span>
                                  {isPortal && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                                      <Globe className="w-3 h-3" />{t('reservations.portal')}
                                    </span>
                                  )}
                                  {isPending ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      <Clock className="w-3 h-3 text-amber-500" />{t('reservations.pending')}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      <CheckCircle className="w-3 h-3 text-emerald-500" />{t('reservations.confirmed')}
                                    </span>
                                  )}
                                  {isUpcoming && r.isConfirmed && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                      {t('reservations.upcoming')}
                                    </span>
                                  )}
                                  {r.isZoneExclusive && (
                                    <span
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200"
                                    >
                                      🏛 {t('reservations.zoneExclusive', { zonePart: r.requestedZoneName ? `: ${r.requestedZoneName}` : '' })}
                                    </span>
                                  )}

                                  {r.occasionType !== undefined && r.occasionType !== 0 && OCCASION_LABELS[r.occasionType] ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${OCCASION_LABELS[r.occasionType].color}`}
                                    >
                                      <span>{OCCASION_LABELS[r.occasionType].icon}</span>
                                      {t(`occasions.${r.occasionType}`)}
                                    </span>
                                  ) : null}
                                </div>

                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('reservations.reservationLabel')}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="font-semibold">{formatReservationTime(r.reservationDateTime)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{t('common.persons', { count: r.numberOfGuests })}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                    {r.tableId && r.tableNumber ? (
                                      <span>{t('reservations.tableAssigned', { num: r.tableNumber, zone: r.zoneName ?? '' })}</span>
                                    ) : (
                                      <span className="text-amber-600 font-medium">
                                        {t('reservations.noTable', { zone: r.requestedZoneName || r.zoneName || '' })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {r.specialRequests && (
                                  <p className="mt-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 inline-block">
                                    {r.specialRequests}
                                  </p>
                                )}

                                {preOrder && preOrder.items.length > 0 && (
                                  <button
                                    onClick={() => setExpandedReservationId(isExpanded ? null : r.id)}
                                    className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-semibold"
                                  >
                                    <UtensilsCrossed className="w-3.5 h-3.5" />
                                    {t('reservations.preOrder', { count: preOrder.items.length })}
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-col gap-2 flex-shrink-0 ml-auto w-[210px]">
                                {isPending ? (

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => r.isZoneExclusive ? openZoneDecision(r, true) : openReservationAssignModal(r)}
                                      className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      {t('reservations.accept')}
                                    </button>
                                    <button
                                      onClick={() => r.isZoneExclusive ? openZoneDecision(r, false) : requestCancelReservation(r)}
                                      className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      {t('reservations.reject')}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => requestCancelReservation(r)}
                                    className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    {t('reservations.cancel')}
                                  </button>
                                )}

                                {!isPending && (
                                  <button
                                    onClick={() => openReservationAssignModal(r)}
                                    className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                  >
                                    <CalendarCheck className="w-4 h-4" />
                                    {t('reservations.reassignTable')}
                                  </button>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openRescheduleModal(r)}
                                    className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-white hover:bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold transition-colors shadow-sm border-2 border-blue-300"
                                    title={t('reservations.moveDateTitle')}
                                  >
                                    <Calendar className="w-4 h-4" />
                                    {t('reservations.moveDate')}
                                  </button>
                                  {(r.customerPhone || r.customerEmail) && (
                                    <button
                                      onClick={() => setContactReservation(r)}
                                      className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-semibold transition-colors border-2 border-blue-200"
                                      title={t('reservations.contactTitle')}
                                    >
                                      <Phone className="w-4 h-4" />
                                      {t('reservations.contact')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isExpanded && preOrder && preOrder.items.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('reservations.preOrderTitle')}</p>
                                <div className="space-y-1.5">
                                  {preOrder.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                      <span className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                          {item.quantity}
                                        </span>
                                        <span className="text-slate-700">{item.dishName}</span>
                                        {item.notes && (
                                          <span className="text-xs text-amber-600">— {item.notes}</span>
                                        )}
                                      </span>
                                      <span className="text-slate-500 font-medium">
                                        ${(item.unitPrice * item.quantity).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                  {preOrder.notes && (
                                    <p className="text-xs text-slate-400 mt-2 italic">{t('reservations.preOrderNote', { notes: preOrder.notes })}</p>
                                  )}
                                  <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-gray-100 mt-1">
                                    <span className="text-slate-600">{t('reservations.preOrderTotal')}</span>
                                    <span className="text-slate-900">
                                      ${preOrder.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'tables' && <>

      <div className="max-w-7xl mx-auto px-6 pt-5 pb-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('filters.zone')}</p>
              {floorPlanEnabled && (
                <button
                  onClick={() => setShowPlan((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  {showPlan ? t('floorPlan.showList') : t('floorPlan.showPlan')}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedZone(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedZone === null
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('filters.allZones')}
                {timeRange && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    selectedZone === null ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {t('filters.resCount', { count: Array.from(reservationsByTableInRange.values()).reduce((s, a) => s + a.length, 0) })}
                  </span>
                )}
              </button>
              {zones.map((zone) => {
                const reservasEnZona = timeRange ? (reservationCountByZone.get(zone.name) ?? 0) : null;
                return (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZone(zone.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selectedZone === zone.id
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {zone.name}
                    {timeRange ? (

                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                        selectedZone === zone.id ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {t('filters.resCount', { count: reservasEnZona ?? 0 })}
                      </span>
                    ) : (
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                        selectedZone === zone.id ? 'bg-white/25 text-white' : 'bg-white text-gray-500'
                      }`}>
                        {zone.availableTables}/{zone.tableCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {t('filters.reservations')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 'any',      label: t('filters.timeAny') },
                { value: 'today',    label: t('filters.timeToday') },
                { value: 'tomorrow', label: t('filters.timeTomorrow') },
                { value: 'week',     label: t('filters.timeWeek') },
                { value: 'custom',   label: t('filters.timeCustom') },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterTime(opt.value as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    filterTime === opt.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {filterTime === 'custom' && (
                <>
                  <input
                    type="date"
                    value={filterTimeFrom}
                    onChange={e => setFilterTimeFrom(e.target.value)}
                    className="border border-blue-300 rounded-lg px-2 py-1 text-sm text-blue-700 bg-blue-50"
                  />
                  <span className="text-gray-400 text-sm">→</span>
                  <input
                    type="date"
                    value={filterTimeTo}
                    onChange={e => setFilterTimeTo(e.target.value)}
                    className="border border-blue-300 rounded-lg px-2 py-1 text-sm text-blue-700 bg-blue-50"
                  />
                </>
              )}

              {timeRange && (
                <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                  {timeRange.from.toLocaleDateString(dl, { day: 'numeric', month: 'short' })}
                  {timeRange.from.toDateString() !== timeRange.to.toDateString() && (
                    <> → {timeRange.to.toLocaleDateString(dl, { day: 'numeric', month: 'short' })}</>
                  )}
                </span>
              )}

            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div className="flex flex-wrap items-end gap-6">

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('filters.status')}</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: t('filters.allStatus'), dot: null },
                  { value: 'Available', label: t('filters.available'), dot: 'bg-green-500' },
                  { value: 'Occupied', label: t('filters.occupied'), dot: 'bg-red-500' },
                  { value: 'Billing', label: t('filters.billing'), dot: 'bg-violet-500' },
                  { value: 'Reserved', label: t('filters.reserved'), dot: 'bg-yellow-400' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterStatus(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      filterStatus === opt.value
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.dot && (
                      <span className={`w-2 h-2 rounded-full ${opt.dot} ${filterStatus === opt.value ? 'opacity-100' : ''}`} />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('filters.capacity')}</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: t('filters.allCapacity'), icon: null },
                  { value: '2', label: t('filters.cap2'), icon: '🪑' },
                  { value: '4', label: t('filters.cap4'), icon: '🪑🪑' },
                  { value: '6+', label: t('filters.cap6'), icon: '🪑🪑🪑' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterCapacity(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      filterCapacity === opt.value
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.icon && <span className="text-xs">{opt.icon}</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {(hasActiveFilters || selectedZone !== null) && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all border border-gray-200 hover:border-red-200"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('common.clearFilters')}
                </button>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 leading-none">{filteredTables.length}</p>
                <p className="text-xs text-gray-400">{t('common.tables', { count: filteredTables.length })}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPlan && floorPlanEnabled ? (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
            <span>{t('floorPlan.tapToManage')}</span>
            <span className="hidden sm:inline">{t('floorPlan.livePlan')}</span>
          </div>
          <div style={{ height: 560 }}>
            <MultiZoneFloorPlanViewer
              data={floorPlanData}
              palette={floorPlanPalette}
              fill
              fitToContent
              selectedTableId={planoSel ?? undefined}
              onTableClick={(id) => {
                setPlanoSel(id);
                const t = tables.find((x) => Number(x.id) === Number(id));
                if (t) setPlanoTable(t);
              }}
            />
          </div>
        </div>
      </div>
      ) : (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredTables.map((table) => (
            <div
              key={table.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
            >

              <div className={`h-1.5 w-full ${getStatusStrip(table.status)}`} />

              <div className="p-4 flex flex-col flex-1">

                <div className="mb-2">

                  <div className="flex items-start justify-between mb-3">
                    <span className="text-4xl font-black text-slate-900 leading-none">
                      {table.tableNumber}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${getStatusBadge(table.status)}`}>
                      {getStatusLabel(table.status)}
                    </span>
                  </div>

                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest truncate">{table.zoneName}</p>
                  <div className="flex items-center gap-1 mt-1 text-slate-500">
                    <Users className="w-3 h-3" />
                    <span className="text-xs">{t('tables.capacity', { count: table.capacity })}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openTableOccupancy(table); }}
                  className="mt-1 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:bg-indigo-200 text-xs font-bold transition-colors"
                >
                  <CalendarCheck className="w-4 h-4" /> {t('tables.viewReservations')}
                </button>

                {(() => {
                  const slots = tableSlots[table.id];

                  if (slots === undefined) {
                    return tableSlotsLoading ? (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3 animate-pulse" />
                        <span className="animate-pulse">{t('tables.loadingSlots')}</span>
                      </div>
                    ) : null;
                  }
                  if (slots.length === 0) {
                    return (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                        <Clock className="w-3 h-3" />
                        {t('tables.noFreeSlots')}
                      </div>
                    );
                  }
                  const MAX_BADGES = 5;
                  const isOpen = openSlotsTableId === table.id;
                  const visible = isOpen ? slots : slots.slice(0, MAX_BADGES);
                  const extra = slots.length - MAX_BADGES;
                  return (
                    <div className="mt-2">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t('tables.freeSlots', { count: slots.length })}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {visible.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold leading-none tabular-nums"
                          >
                            {to12h(s)}
                          </span>
                        ))}
                        {!isOpen && extra > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOpenSlotsTableId(table.id); }}
                            className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold leading-none hover:bg-slate-200 transition-colors"
                          >
                            {t('tables.moreSlots', { count: extra })}
                          </button>
                        )}
                        {isOpen && extra > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOpenSlotsTableId(null); }}
                            className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold leading-none hover:bg-slate-200 transition-colors"
                          >
                            {t('tables.lessSlots')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {timeRange && (() => {
                  const rsv = reservationsByTableInRange.get(table.id) ?? [];
                  if (rsv.length === 0) return null;
                  const earliest = rsv.slice().sort((a, b) =>
                    new Date(a.reservationDateTime).getTime() - new Date(b.reservationDateTime).getTime()
                  )[0];
                  const dt = new Date(earliest.reservationDateTime);
                  const dayLabel = dt.toLocaleDateString(dl, { day: 'numeric', month: 'short' });
                  const timeLabel = dt.toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-blue-900 leading-tight">
                          {t('tables.reservationsBadge', { count: rsv.length })}
                        </p>
                        <p className="text-[10px] text-blue-700 truncate">
                          {t('tables.nextBadge', { label: dayLabel, time: timeLabel })}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const tableReservas = reservations
                    .filter(r => r.tableId === table.id && !r.isCancelled)
                    .filter(r => {
                      const dt = new Date(r.reservationDateTime);
                      const cutoff = new Date();
                      cutoff.setHours(0, 0, 0, 0);
                      return dt >= cutoff;
                    })
                    .sort((a, b) => {
                      const sa = a.isConfirmed ? 1 : 0;
                      const sb = b.isConfirmed ? 1 : 0;
                      if (sa !== sb) return sa - sb;
                      return new Date(a.reservationDateTime).getTime() - new Date(b.reservationDateTime).getTime();
                    });
                  const hasReserva = tableReservas.length > 0;
                  const isPhysicallyBusy = table.status === 'Occupied' || table.status === 'Billing' || table.status === 'Cleaning';

                  if (isPhysicallyBusy) {
                    return (
                      <div className="mt-auto pt-3">
                        {table.status === 'Billing' ? (
                          <div className="w-full py-3 px-2 rounded-xl text-center bg-violet-50 border border-violet-200">
                            <p className="text-xs font-bold text-violet-700 leading-tight">{t('tables.billing')}</p>
                            <p className="text-[10px] text-violet-500 mt-0.5">{t('tables.billingFree')}</p>
                          </div>
                        ) : (
                          <div className={`w-full py-3 rounded-xl text-xs font-semibold text-center ${
                            table.status === 'Occupied' ? 'bg-red-50 text-red-500'
                            : 'bg-blue-50 text-blue-500'
                          }`}>
                            {table.status === 'Occupied' ? t('tables.inUse') : t('tables.cleaning')}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (hasReserva) {
                    const r = tableReservas[0];
                    const isPending = !r.isConfirmed;
                    const extra = tableReservas.length - 1;
                    const dt = new Date(r.reservationDateTime);
                    const now = new Date();
                    const hoursUntil = (dt.getTime() - now.getTime()) / 3600000;
                    const dayLabel = dt.toLocaleDateString(dl, { day: 'numeric', month: 'short' });
                    const timeLabel = dt.toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' });
                    const dayLong = dt.toLocaleDateString(dl, { weekday: 'short' }).replace('.', '');

                    const allowWalkIn = hoursUntil > 2;

                    return (
                      <div className="mt-3 flex flex-col flex-1">

                        <div className={`rounded-xl p-2.5 ${
                          isPending ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'
                        }`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-bold text-sm text-slate-900 truncate flex-1" title={r.customerName}>
                              {r.customerName}
                            </p>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isPending ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'
                            }`}>
                              {isPending ? 'Pend' : 'OK'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-snug">
                            <span className="font-semibold">{dayLong} {dayLabel}</span> · {timeLabel}
                            <br />
                            <span className="text-slate-500">{t('common.persons', { count: r.numberOfGuests })}</span>
                          </p>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); openReservationAssignModal(r); }}
                          className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-colors ${
                            isPending ? 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700' : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                          }`}
                        >
                          {isPending ? (
                            <><CheckCircle className="w-4 h-4" /> {t('tables.accept')}</>
                          ) : (
                            <><CalendarCheck className="w-4 h-4" /> {t('tables.reassign')}</>
                          )}
                        </button>

                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); requestCancelReservation(r); }}
                            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100 text-[11px] font-semibold transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {isPending ? t('tables.reject') : t('reservations.cancel')}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openRescheduleModal(r); }}
                            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 active:bg-blue-100 text-[11px] font-semibold transition-colors"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {t('tables.move')}
                          </button>
                        </div>

                        {extra > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openTableOccupancy(table); }}
                            className="mt-1.5 w-full py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded transition-colors flex items-center justify-center gap-1"
                          >
                            <ChevronDown className="w-3 h-3" />
                            {t('tables.moreReservations', { count: extra })}
                          </button>
                        )}

                        {allowWalkIn && (
                          <>
                            <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                              <p className="text-[9px] text-slate-400 uppercase tracking-wider text-center mb-1.5">
                                {t('tables.walkin')}
                              </p>
                              <button
                                onClick={() => openAssignModal(table)}
                                className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-[11px] font-semibold transition-colors"
                              >
                                {t('tables.assignNow')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="mt-auto pt-3 space-y-2">
                      <button
                        onClick={() => openAssignModal(table)}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                      >
                        {t('tables.assign')}
                      </button>
                      <button
                        onClick={() => openReservationModal(table)}
                        className="w-full py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                      >
                        {t('tables.reserve')}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {planoTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }} onClick={() => setPlanoTable(null)}>
          <div style={{ width: '100%', maxWidth: 380 }} onClick={(e) => e.stopPropagation()} className="overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('assign.tableNumber', { num: planoTable.tableNumber })}</h3>
                <p className="text-xs text-slate-500">{t('planoModal.capacity', { zoneName: planoTable.zoneName, count: planoTable.capacity })}</p>
              </div>
              <button type="button" onClick={() => setPlanoTable(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2 p-5">
              {planoTable.status === 'Available' ? (
                <>
                  <button type="button" onClick={() => { const pt = planoTable; setPlanoTable(null); openAssignModal(pt); }} className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: '#16a34a' }}>
                    <Users className="h-4 w-4" /> {t('planoModal.seatGuests')}
                  </button>
                  <button type="button" onClick={() => { const pt = planoTable; setPlanoTable(null); openReservationModal(pt); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <CalendarCheck className="h-4 w-4" /> {t('planoModal.reserve')}
                  </button>
                  <button type="button" onClick={() => { const pt = planoTable; setPlanoTable(null); openTableOccupancy(pt); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Calendar className="h-4 w-4" /> {t('planoModal.viewReservations')}
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-1 text-xs text-slate-500">{t('planoModal.statusDescription', { status: getStatusLabel(planoTable.status) })}</p>
                  <button type="button" onClick={() => { const pt = planoTable; setPlanoTable(null); openTableOccupancy(pt); }} className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: '#16a34a' }}>
                    <Calendar className="h-4 w-4" /> {t('planoModal.viewReservations')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      </>}

      {tableReservasModal && (() => {
        const tbl = tableReservasModal.table;
        const dayRes = occTableDate ? occupancyForTableOnDate(tbl, occTableDate) : [];
        const dateLabel = occTableDate
          ? new Date(occTableDate + 'T00:00:00').toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : '';
        return (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setTableReservasModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >

            <div className="bg-indigo-600 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4" />
                  {t('occupancy.modalTitle', { num: tbl.tableNumber })}
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  {t('occupancy.zoneCapacity', { zone: tbl.zoneName, cap: tbl.capacity })}
                </p>
              </div>
              <button onClick={() => setTableReservasModal(null)} className="p-1.5 hover:bg-white/10 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">

              <div className="px-4 pt-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <button type="button" onClick={() => setOccTableMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200" aria-label={t('occupancy.prevMonth')}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <p className="text-sm font-bold capitalize text-slate-700">{occTableMonth.toLocaleDateString(dl, { month: 'long', year: 'numeric' })}</p>
                    <button type="button" onClick={() => setOccTableMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200" aria-label={t('occupancy.nextMonth')}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mb-1 grid grid-cols-7">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                      <span key={i} className="py-1 text-center text-[10px] font-bold uppercase text-slate-400">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const year = occTableMonth.getFullYear();
                      const month = occTableMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const cells: any[] = [];
                      for (let i = 0; i < firstDay; i++) cells.push(<div key={`b${i}`} />);
                      for (let d = 1; d <= daysInMonth; d++) {
                        const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isSel = ymd === occTableDate;
                        const count = occupancyForTableOnDate(tbl, ymd).length;
                        cells.push(
                          <button
                            key={ymd}
                            type="button"
                            onClick={() => setOccTableDate(ymd)}
                            className={[
                              'relative flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors',
                              isSel ? 'bg-indigo-600 font-bold text-white' : 'text-slate-700 hover:bg-slate-200',
                            ].join(' ')}
                          >
                            {d}
                            {count > 0 && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSel ? 'bg-white' : 'bg-indigo-500'}`} />}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 capitalize">{dateLabel}</p>
                {dayRes.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    <CalendarCheck className="mx-auto mb-2 h-7 w-7 opacity-40" />
                    {t('occupancy.noConfirmed')}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayRes.map(r => {
                      const seated = r.status === 'Seated';
                      return (
                        <div key={r.id} className={`rounded-lg p-3 border-l-4 ${seated ? 'bg-blue-50 border-blue-400' : 'bg-emerald-50 border-emerald-400'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className={`font-bold text-sm truncate ${r.customerName ? 'text-slate-900' : 'italic text-slate-400'}`}>{r.customerName || (r.confirmationCode ? `Reserva ${r.confirmationCode}` : 'Sin nombre')}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${seated ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {seated ? t('occupancy.seated') : t('occupancy.confirmed')}
                            </span>
                          </div>
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{to12h((r.reservationDateTime || '').slice(11, 16))}</span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t('common.persons', { count: r.numberOfGuests })}</span>
                            {r.occasionType && r.occasionType !== 0 && OCCASION_LABELS[r.occasionType] ? (
                              <span>{OCCASION_LABELS[r.occasionType].icon} {t(`occasions.${r.occasionType}`)}</span>
                            ) : null}
                          </p>
                          {r.specialRequests && <p className="mt-1 text-[11px] italic text-amber-600 truncate" title={r.specialRequests}>“{r.specialRequests}”</p>}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.customerPhone && (
                              <a href={`tel:${r.customerPhone}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-semibold transition-colors">
                                <Phone className="w-3 h-3" /> {t('occupancy.contact')}
                              </a>
                            )}
                            {!seated && (
                              <>
                                <button onClick={() => { openReservationAssignModal(r); setTableReservasModal(null); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-semibold">
                                  <CalendarCheck className="w-3 h-3" /> {t('occupancy.reassign')}
                                </button>
                                <button onClick={() => { openRescheduleModal(r); setTableReservasModal(null); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-[11px] font-semibold">
                                  <Calendar className="w-3 h-3" /> {t('occupancy.move')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-2.5 border-t flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500">{t('occupancy.dayCount', { count: dayRes.length })}</span>
              <button
                onClick={() => setTableReservasModal(null)}
                className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {showAssignModal && selectedTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{t('assign.header')}</p>
                <h2 className="text-xl font-bold text-white">{t('assign.tableNumber', { num: selectedTable.tableNumber })}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t('assign.zoneCapacity', { zone: selectedTable.zoneName, cap: selectedTable.capacity })}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  {t('assign.numberOfPersons')}
                </label>
                <input
                  type="number"
                  value={numberOfGuests}
                  onChange={(e) => setNumberOfGuests(e.target.value)}
                  max={selectedTable.capacity}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900"
                  placeholder={t('assign.maxCapacity', { max: selectedTable.capacity })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  {t('assign.specialNotes')}
                </label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 resize-none"
                  rows={3}
                  placeholder={t('assign.specialNotesPlaceholder')}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-semibold transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={assignTable} className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 text-sm font-semibold transition-colors shadow-sm">
                  {t('assign.assignButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReservationModal && selectedTable && (
        <HostReservationWizard
          table={selectedTable}
          hostId={user?.id ?? null}
          menuDishes={menuDishes}
          api={api}
          onClose={() => setShowReservationModal(false)}
          onCreated={() => { setShowReservationModal(false); loadData(); }}
        />
      )}

      {zoneDecisionModal && (() => {
        const r = zoneDecisionModal.r;
        const accept = zoneDecisionModal.accept;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !zoneDeciding && setZoneDecisionModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className={`px-6 py-4 flex items-center gap-3 border-b ${accept ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className={`rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 ${accept ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  <span className="text-lg">🏛</span>
                </div>
                <div className="min-w-0">
                  <h3 className={`text-lg font-bold ${accept ? 'text-emerald-900' : 'text-red-900'}`}>
                    {accept ? t('zoneDecision.acceptTitle') : t('zoneDecision.rejectTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">{r.customerName} · {r.requestedZoneName || r.zoneName || '—'} · {r.numberOfGuests} pers</p>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600 mb-3">
                  {accept
                    ? <>{t('zoneDecision.acceptDesc', { zone: r.requestedZoneName || '' })}</>
                    : <>{t('zoneDecision.rejectDesc')}</>}
                </p>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('zoneDecision.messageLabel')}</label>
                <textarea
                  value={zoneDecisionMsg}
                  onChange={(e) => setZoneDecisionMsg(e.target.value)}
                  rows={3}
                  placeholder={accept ? t('zoneDecision.acceptPlaceholder') : t('zoneDecision.rejectPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="bg-slate-50 px-6 py-3 flex items-center justify-end gap-2 border-t">
                <button onClick={() => setZoneDecisionModal(null)} disabled={zoneDeciding} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                  {t('common.close')}
                </button>
                <button
                  onClick={submitZoneDecision}
                  disabled={zoneDeciding || (!accept && !zoneDecisionMsg.trim())}
                  className={`px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-50 ${accept ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {zoneDeciding ? t('zoneDecision.sending') : (accept ? t('zoneDecision.accept') : t('zoneDecision.reject'))}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {cancelConfirmReservation && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !cancellingReservation && setCancelConfirmReservation(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !cancellingReservation) setCancelConfirmReservation(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-3">
              <div className="bg-red-100 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 id="cancel-modal-title" className="text-lg font-bold text-red-900">
                {cancelConfirmReservation.isConfirmed ? t('cancelModal.cancelTitle') : t('cancelModal.rejectTitle')}
              </h3>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                {cancelConfirmReservation.isConfirmed
                  ? t('cancelModal.confirmedDesc')
                  : t('cancelModal.pendingDesc')}
              </p>

              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-900">
                    {cancelConfirmReservation.customerName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {new Date(cancelConfirmReservation.reservationDateTime).toLocaleString('es-DO', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {t('common.persons', { count: cancelConfirmReservation.numberOfGuests })}
                    {cancelConfirmReservation.tableId && cancelConfirmReservation.tableNumber && (
                      <> · {t('reservations.tableAssigned', { num: cancelConfirmReservation.tableNumber, zone: cancelConfirmReservation.zoneName ?? '' })}</>
                    )}
                    {!cancelConfirmReservation.tableId && (
                      <> · {t('reservations.noTable', { zone: cancelConfirmReservation.requestedZoneName || cancelConfirmReservation.zoneName || '' })}</>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t flex justify-end gap-2">
              <button
                onClick={() => setCancelConfirmReservation(null)}
                disabled={cancellingReservation}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('cancelModal.keep')}
              </button>
              <button
                onClick={confirmCancelReservation}
                disabled={cancellingReservation}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {cancellingReservation ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    {t('cancelModal.cancelling')}
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    {cancelConfirmReservation.isConfirmed ? t('cancelModal.yesCancel') : t('cancelModal.yesReject')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {contactReservation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setContactReservation(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{t('contactModal.title')}</p>
                <h2 className="text-lg font-bold text-white truncate">{contactReservation.customerName}</h2>
              </div>
              <button onClick={() => setContactReservation(null)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {contactReservation.customerPhone ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">{t('contactModal.phone')}</p>
                      <p className="text-slate-900 font-semibold truncate">{contactReservation.customerPhone}</p>
                    </div>
                  </div>
                  <a href={`tel:${contactReservation.customerPhone}`} className="flex-shrink-0 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold">{t('contactModal.call')}</a>
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t('contactModal.noPhone')}</p>
              )}
              {contactReservation.customerEmail ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">{t('contactModal.email')}</p>
                      <p className="text-slate-900 font-semibold truncate">{contactReservation.customerEmail}</p>
                    </div>
                  </div>
                  <a href={`mailto:${contactReservation.customerEmail}`} className="flex-shrink-0 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold">{t('contactModal.send')}</a>
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t('contactModal.noEmail')}</p>
              )}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setContactReservation(null)} className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-gray-50">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {rescheduleModalForReservation && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closeRescheduleModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('reschedule.title')}
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {rescheduleModalForReservation.customerName} · {rescheduleModalForReservation.numberOfGuests} pers
                </p>
              </div>
              <button onClick={closeRescheduleModal} className="p-1.5 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                <p className="text-xs text-slate-500 mb-1">{t('reschedule.currentDateTime')}</p>
                <p className="font-semibold text-slate-700">
                  {new Date(rescheduleModalForReservation.reservationDateTime).toLocaleString(dl, {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> {t('reschedule.newDate')}
                  </span>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> {t('reschedule.newTime')}
                  </span>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              {rescheduleDate && rescheduleTime && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="text-xs text-blue-600 mb-1">{t('reschedule.movedTo')}</p>
                  <p className="font-semibold text-blue-900">
                    {new Date(`${rescheduleDate}T${rescheduleTime}:00`).toLocaleString(dl, {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
              {rescheduleModalForReservation.tableId && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  {t('reschedule.tableKept', { num: rescheduleModalForReservation.tableNumber })}
                </p>
              )}
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t flex justify-end gap-2">
              <button
                onClick={closeRescheduleModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => submitReschedule()}
                disabled={rescheduling || !rescheduleDate || !rescheduleTime}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {rescheduling ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    {t('reschedule.moving')}
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5" />
                    {t('reschedule.confirm')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {calendarDaySelected && (() => {

        const dayReservas = reservations.filter(r => {
          if (r.isCancelled || TERMINAL_RESERVATION_STATUS.has(r.status || '')) return false;
          const k = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
          return k === calendarDaySelected;
        });
        const otherReservas = reservations.filter(r => {
          const k = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
          return k !== calendarDaySelected;
        });
        const dayLabel = new Date(calendarDaySelected + 'T12:00:00').toLocaleDateString(dl, {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        return (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setCalendarDaySelected(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {dayLabel}
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {t('calendarDay.dayCount', { count: dayReservas.length })}
                  </p>
                </div>
                <button onClick={() => setCalendarDaySelected(null)} className="p-1.5 hover:bg-white/10 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">

                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                    {t('calendarDay.dayReservations')}
                  </p>

                  {(() => {
                    const groups = new Map<number, number>();
                    dayReservas.forEach(r => {
                      const t = r.occasionType ?? 0;
                      groups.set(t, (groups.get(t) || 0) + 1);
                    });
                    if (groups.size <= 1) return null;
                    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a - b);
                    return (
                      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
                        <button
                          onClick={() => setDayModalOccasionFilter('all')}
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            dayModalOccasionFilter === 'all'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {t('calendarDay.allFilter', { count: dayReservas.length })}
                        </button>
                        {sortedGroups.map(([occType, count]) => {
                          const meta = OCCASION_LABELS[occType];
                          if (!meta) return null;
                          const isActive = dayModalOccasionFilter === occType;
                          return (
                            <button
                              key={occType}
                              onClick={() => setDayModalOccasionFilter(occType)}
                              className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                isActive
                                  ? meta.color + ' ring-2 ring-offset-1 ring-blue-300'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {meta.icon && <span className="text-sm leading-none">{meta.icon}</span>}
                              {t(`occasions.${occType}`)} ({count})
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {(() => {
                    const filteredDayReservas = dayModalOccasionFilter === 'all'
                      ? dayReservas
                      : dayReservas.filter(r => (r.occasionType ?? 0) === dayModalOccasionFilter);
                    if (dayReservas.length === 0) {
                      return (
                        <p className="text-sm text-slate-400 italic bg-slate-50 rounded-lg p-3">
                          {t('calendarDay.noReservationsDay')}
                        </p>
                      );
                    }
                    if (filteredDayReservas.length === 0) {
                      const filterMeta = OCCASION_LABELS[dayModalOccasionFilter as number];
                      return (
                        <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 flex items-center gap-2">
                          <span>{t('calendarDay.noOccasionFilter', { icon: filterMeta?.icon ?? '', label: filterMeta ? t(`occasions.${dayModalOccasionFilter as number}`) : '' })}</span>
                          <button
                            onClick={() => setDayModalOccasionFilter('all')}
                            className="ml-auto text-blue-600 hover:underline font-semibold text-xs"
                          >
                            {t('calendarDay.showAll')}
                          </button>
                        </div>
                      );
                    }
                    return (
                    <div className="space-y-2">
                      {filteredDayReservas.map(r => {
                        const isCancelled = r.isCancelled;
                        const isPending = !r.isConfirmed && !isCancelled;
                        return (
                          <div key={r.id} className={`border rounded-lg p-3 flex items-center gap-3 ${
                            isCancelled
                              ? 'bg-red-50/40 border-red-100 opacity-70'
                              : isPending
                                ? 'bg-amber-50/40 border-amber-200'
                                : 'bg-emerald-50/30 border-emerald-200'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{r.customerName}</p>
                              <p className="text-xs text-slate-500">
                                🕐 {formatReservationTime(r.reservationDateTime)} · 👥 {r.numberOfGuests} pers
                                {r.tableNumber && ` · Mesa ${r.tableNumber}`}
                                {!r.tableNumber && r.requestedZoneName && ` · Zona ${r.requestedZoneName}`}
                              </p>
                              {(() => {
                                const occType = r.occasionType;
                                if (occType === undefined || occType === 0) return null;
                                const occMeta = OCCASION_LABELS[occType];
                                if (!occMeta) return null;
                                return (
                                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold border ${occMeta.color}`}>
                                      <span className="text-sm leading-none">{occMeta.icon}</span>
                                      {t(`occasions.${occType}`)}
                                    </span>
                                    {r.specialRequests && (
                                      <span className="text-[11px] text-slate-500 italic truncate" title={r.specialRequests}>
                                        “{r.specialRequests}”
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                isCancelled
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : r.isConfirmed
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {isCancelled ? t('status.cancelled') : r.isConfirmed ? t('status.confirmed') : t('status.pending')}
                              </span>
                              {!isCancelled && (
                                <button
                                  onClick={() => openReservationAssignModal(r)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm text-white ${
                                    isPending
                                      ? 'bg-emerald-500 hover:bg-emerald-600'
                                      : 'bg-blue-500 hover:bg-blue-600'
                                  }`}
                                >
                                  {isPending ? (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      {t('reservations.accept')}
                                    </>
                                  ) : (
                                    <>
                                      <CalendarCheck className="w-3.5 h-3.5" />
                                      {t('reservations.reassignTable')}
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    );
                  })()}
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                    {t('calendarDay.moveSection')}
                  </p>
                  {otherReservas.length === 0 ? (
                    <p className="text-sm text-slate-400 italic bg-slate-50 rounded-lg p-3">
                      {t('calendarDay.noOtherReservations')}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {otherReservas.map(r => {
                        const origDt = new Date(r.reservationDateTime);
                        const newDateTime = `${calendarDaySelected}T${String(origDt.getHours()).padStart(2,'0')}:${String(origDt.getMinutes()).padStart(2,'0')}:00`;
                        return (
                          <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 hover:border-blue-300 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{r.customerName}</p>
                              <p className="text-xs text-slate-500">
                                {t('calendarDay.currentlyAt', { date: new Date(r.reservationDateTime).toLocaleDateString(dl, { day: 'numeric', month: 'short' }), time: formatReservationTime(r.reservationDateTime) })}
                                {' '}· 👥 {r.numberOfGuests}
                                {r.tableNumber && ` · Mesa ${r.tableNumber}`}
                              </p>
                            </div>
                            <button
                              onClick={() => submitReschedule(r, newDateTime)}
                              disabled={rescheduling}
                              className="flex-shrink-0 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                            >
                              {t('calendarDay.moveHere')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t flex justify-end">
                <button
                  onClick={() => setCalendarDaySelected(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {assignModalForReservation && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closeReservationAssignModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5" />
                  {assignModalForReservation.isConfirmed ? t('reservations.reassignTable') : t('reservations.accept')}
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {assignModalForReservation.customerName} · {assignModalForReservation.numberOfGuests} pers · {t('assign.requestedZone')}{' '}
                  <span className="font-semibold">
                    {assignModalForReservation.requestedZoneName || assignModalForReservation.zoneName || '—'}
                  </span>
                </p>
              </div>
              <button onClick={closeReservationAssignModal} className="p-1.5 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-120px)]">

              {allZonesForAssign.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
                    {t('assign.zoneLabel')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allZonesForAssign.map(z => {
                      const isOriginal = z.id === assignModalForReservation.requestedZoneId;
                      const isActive = z.id === assignableZoneId;
                      return (
                        <button
                          key={z.id}
                          onClick={() => changeAssignableZone(z.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isActive
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white text-slate-600 border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          {z.name}
                          {isOriginal && (
                            <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${
                              isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {t('assign.requested')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {loadingAssignable ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-sm text-slate-500">{t('assign.loadingTables')}</p>
                </div>
              ) : assignableTables.length === 0 ? (
                <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-900 font-semibold">{t('assign.noAvailability')}</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {t('assign.noAvailabilityDesc', { guests: assignModalForReservation.numberOfGuests })}
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    {t('assign.noAvailabilityHint')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      {t('assign.availableTables')}
                    </p>
                    {assignableZoneId !== assignModalForReservation.requestedZoneId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                        {t('assign.differentZone')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {assignableTables.map((assignableTable) => {
                      const disabled = assignableTable.isOccupied || assigningTableId !== null;
                      return (
                        <button
                          key={assignableTable.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => !assignableTable.isOccupied && assignTableToReservation(assignableTable.id)}
                          className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                            assignableTable.isCurrent
                              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300'
                              : assignableTable.isOccupied
                                ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                                : 'border-blue-200 bg-white hover:border-blue-500 hover:bg-blue-50'
                          }`}
                        >
                          <div className="text-2xl font-bold text-slate-900">
                            {t('assign.tableNumber', { num: assignableTable.tableNumber })}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {t('assign.personas', { count: assignableTable.capacity })}
                          </div>
                          {assignableTable.isCurrent && (
                            <span className="absolute top-1.5 right-1.5 text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                              {t('assign.currentTable')}
                            </span>
                          )}
                          {assignableTable.isOccupied && !assignableTable.isCurrent && (
                            <span className="absolute top-1.5 right-1.5 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded-full font-medium">
                              {t('assign.occupiedTable')}
                            </span>
                          )}
                          {assigningTableId === assignableTable.id && (
                            <div className="absolute inset-0 bg-blue-500/10 rounded-xl flex items-center justify-center">
                              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t flex justify-end">
              <button
                onClick={closeReservationAssignModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarView({
  reservations,
  onDayClick,
}: {
  reservations: Reservation[];
  onDayClick: (dateKey: string) => void;
}) {
  const t = useTranslations();
  const dl = dateLocale(useLocale());
  const today = new Date();
  const todayKey = today.toLocaleDateString('sv-SE');
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const byDate = reservations
    .filter((r) => !r.isCancelled && !TERMINAL_RESERVATION_STATUS.has(r.status || ''))
    .reduce<Record<string, Reservation[]>>((acc, r) => {
      const k = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
      if (!acc[k]) acc[k] = [];
      acc[k].push(r);
      return acc;
    }, {});

  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const dayOfWeekStart = firstDay.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < dayOfWeekStart; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }

  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = viewMonth.toLocaleDateString(dl, { month: 'long', year: 'numeric' });
  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  const goToday = () => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  const weekDayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-5 pb-10">

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={t('calendar.prevMonth')}
          >
            <ChevronDown className="w-5 h-5 rotate-90 text-slate-600" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900 capitalize min-w-[200px] text-center">
            {monthName}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={t('calendar.nextMonth')}
          >
            <ChevronDown className="w-5 h-5 -rotate-90 text-slate-600" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
        >
          {t('calendar.today')}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        <div className="grid grid-cols-7 bg-slate-50 border-b border-gray-100">
          {weekDayLabels.map((d, i) => (
            <div
              key={d}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wider text-center ${
                i === 0 || i === 6 ? 'text-rose-500' : 'text-slate-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="aspect-square border-r border-b border-gray-100 bg-slate-50/50" />;
            }
            const key = date.toLocaleDateString('sv-SE');
            const dayReservas = byDate[key] || [];
            const total = dayReservas.length;
            const pending = dayReservas.filter(r => !r.isConfirmed).length;
            const confirmed = total - pending;
            const birthdays = dayReservas.filter(r => r.occasionType === 1).length;
            const specials = dayReservas.filter(r => r.occasionType && r.occasionType !== 0 && r.occasionType !== 1).length;
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <button
                key={key}
                onClick={() => total > 0 && onDayClick(key)}
                disabled={total === 0}
                className={`aspect-square border-r border-b border-gray-100 p-2 text-left transition-all flex flex-col gap-1 ${
                  total > 0 ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-default'
                } ${isToday ? 'bg-blue-50/40 ring-2 ring-blue-300 ring-inset' : ''} ${isPast ? 'opacity-60' : ''}`}
                title={total > 0 ? t('calendar.dayCount', { count: total }) : t('calendar.noReservations')}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-base font-bold ${
                    isToday
                      ? 'text-blue-600'
                      : isWeekend
                        ? 'text-rose-500'
                        : 'text-slate-700'
                  }`}>
                    {date.getDate()}
                  </span>
                  {total > 0 && (
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {total}
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="flex flex-col gap-1 flex-1 overflow-hidden text-sm">
                    {confirmed > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                        {t('calendar.confirmed', { count: confirmed })}
                      </div>
                    )}
                    {pending > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                        {t('calendar.pending', { count: pending })}
                      </div>
                    )}
                    {birthdays > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <span className="text-base leading-none">🎂</span> {birthdays}
                      </div>
                    )}
                    {specials > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <span className="text-base leading-none">✨</span> {specials}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{t('calendar.legendConfirmed')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>{t('calendar.legendPending')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>🎂</span>
          <span>{t('calendar.legendBirthdays')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>✨</span>
          <span>{t('calendar.legendOccasions')}</span>
        </div>
        <div className="ml-auto text-slate-400">
          {t('calendar.clickHint')}
        </div>
      </div>
    </div>
  );
}
