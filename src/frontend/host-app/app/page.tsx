'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Users, Calendar, LogOut, X, Clock, Phone, Mail, User, CreditCard, CheckCircle, XCircle, CalendarCheck, Globe, UtensilsCrossed, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import * as signalR from '@microsoft/signalr';
import { createAuthApi } from '@/lib/auth-client';
import HostReservationWizard from '@/components/HostReservationWizard';

// F3 — auth-client centralizado reemplaza el interceptor JWT inline.
const { api } = createAuthApi('host');

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
  numberOfGuests: number;
  reservationDateTime: string;
  isConfirmed: boolean;
  isCancelled?: boolean;
  tableNumber: number | null;
  tableId: number | null;
  zoneName: string | null;
  requestedZoneId?: number | null;
  requestedZoneName?: string | null;
  specialRequests?: string;
  occasionType?: number; // 0=Casual, 1=Birthday, 2=Anniversary, 3=Business, 4=Romantic, 5=FamilyCelebration, 99=Other
  source?: string;
  advanceBlockMinutes?: number;
  preOrder?: PreOrder | null;
  // Host (empleado) que aceptó/creó la reserva — visible en cards y modales
  createdByHostId?: number | null;
  createdByHostName?: string | null;
}

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

// CAL-FE — Disponibilidad/ocupación (endpoints read-only nuevos del backend)
interface OccupancyBlock {
  time: string;            // "19:00"
  covers: number;
  maxCovers: number;
  reservations: number;
  maxReservations: number;
  status: 'available' | 'limited' | 'full';
}
interface OccupancyServiceWindow {
  label: string;
  start: string;
  end: string;
}
interface OccupancyResponse {
  date: string;
  slotMinutes: number;
  serviceWindows: OccupancyServiceWindow[];
  blocks: OccupancyBlock[];
}
interface TableAvailability {
  tableId: number;
  tableNumber: number;
  zoneName: string;
  capacity: number;
  freeSlots: string[];     // ["12:00","12:30","19:00"]
}
interface TablesAvailabilityResponse {
  date: string;
  slotMinutes: number;
  tables: TableAvailability[];
}

export default function HostApp() {
  const [user, setUser] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  // Guard de hidratación: el dashboard es auth-gated (SSR no tiene token → render vacío).
  // Renderizamos el loader hasta montar en el cliente, evitando el mismatch SSR/cliente
  // (#418) que dejaba la página en blanco al recargar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [showAssignModal, setShowAssignModal] = useState(false);
  // HOST-MESAS-RESERVAS.2 — mini-modal para "+N más" reservas de una mesa
  const [tableReservasModal, setTableReservasModal] = useState<{ table: Table; reservas: Reservation[] } | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // View tabs: 'tables' or 'reservations'
  const [activeView, setActiveView] = useState<'tables' | 'reservations' | 'calendar'>('tables');

  // Reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationFilter, setReservationFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  // ASSIGN-DATE-FILTER: filtro DESDE→HASTA en tab Reservas (combinable con tab status)
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  // UX: búsqueda por nombre/teléfono/email de cliente
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingAlert, setPendingAlert] = useState(0);
  const [expandedReservationId, setExpandedReservationId] = useState<number | null>(null);
  // RESCHEDULE: Modal mover reserva a otra fecha/hora
  const [rescheduleModalForReservation, setRescheduleModalForReservation] = useState<Reservation | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);
  // Día seleccionado en calendario (para abrir modal CalendarDay)
  const [calendarDaySelected, setCalendarDaySelected] = useState<string | null>(null);
  // Filtro de ocasión dentro del modal CalendarDay ('all' o el occasionType numérico)
  const [dayModalOccasionFilter, setDayModalOccasionFilter] = useState<number | 'all'>('all');
  // Reset filtro cuando se cambia de día o se cierra el modal
  useEffect(() => { setDayModalOccasionFilter('all'); }, [calendarDaySelected]);

  // ASSIGN.4: Modal de asignación de mesa a reserva
  const [assignModalForReservation, setAssignModalForReservation] = useState<Reservation | null>(null);
  const [contactReservation, setContactReservation] = useState<Reservation | null>(null);
  const [assignableTables, setAssignableTables] = useState<AssignableTable[]>([]);
  const [loadingAssignable, setLoadingAssignable] = useState(false);
  const [assigningTableId, setAssigningTableId] = useState<number | null>(null);
  // Zona actualmente filtrada en el modal (default: la pedida por el cliente)
  const [assignableZoneId, setAssignableZoneId] = useState<number | null>(null);
  const [allZonesForAssign, setAllZonesForAssign] = useState<Zone[]>([]);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCapacity, setFilterCapacity] = useState<string>('all');
  // HOST-MESAS-FILTRO.1 — Filtro temporal de reservas en tab Mesas
  // 'any' = sin filtro | 'today' | 'tomorrow' | 'week' (próximos 7 días) | 'custom' (rango DESDE→HASTA)
  const [filterTime, setFilterTime] = useState<'any' | 'today' | 'tomorrow' | 'week' | 'custom'>('any');
  const [filterTimeFrom, setFilterTimeFrom] = useState<string>('');
  const [filterTimeTo, setFilterTimeTo] = useState<string>('');

  // CAL-FE FEATURE 1 — Modal calendario + ocupación por bloque
  const [showOccupancyModal, setShowOccupancyModal] = useState(false);
  const [occupancyDate, setOccupancyDate] = useState<string>(() => new Date().toLocaleDateString('sv-SE'));
  const [occMonth, setOccMonth] = useState<Date>(() => new Date()); // mes navegable del calendario de ocupación del modal
  const [occupancyData, setOccupancyData] = useState<OccupancyResponse | null>(null);
  const [occLoading, setOccLoading] = useState(false);
  const [occError, setOccError] = useState(false);

  // CAL-FE FEATURE 2 — Slots libres por mesa (mapa tableId -> freeSlots[])
  const [tableSlots, setTableSlots] = useState<Record<number, string[]>>({});
  const [tableSlotsLoading, setTableSlotsLoading] = useState(false);
  // Dropdown de "Horarios libres" abierto por tarjeta (tableId) — null = ninguno
  const [openSlotsTableId, setOpenSlotsTableId] = useState<number | null>(null);

  // Assign form
  const [numberOfGuests, setNumberOfGuests] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  // Menú para el wizard de reserva (lazy-load en openReservationModal → prop de HostReservationWizard)
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

      // Normalizar zonas (camelCase/PascalCase → camelCase uniforme)
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

      // Normalizar mesas
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
      const msg = error?.response?.data?.error || error?.message || 'Error al cargar mesas y zonas';
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

  // CAL-FE FEATURE 1 — cargar ocupación por bloque de un día
  const loadOccupancy = useCallback(async (date: string) => {
    if (!date) return;
    setOccLoading(true);
    setOccError(false);
    try {
      const res = await api.get(`/api/tablereservation/availability/occupancy?date=${date}`);
      const data = res.data as OccupancyResponse;
      setOccupancyData({
        date: data?.date ?? date,
        slotMinutes: data?.slotMinutes ?? 0,
        serviceWindows: Array.isArray(data?.serviceWindows) ? data.serviceWindows : [],
        blocks: Array.isArray(data?.blocks) ? data.blocks : [],
      });
    } catch {
      setOccupancyData(null);
      setOccError(true);
    } finally {
      setOccLoading(false);
    }
  }, []);

  // Cargar tablas disponibles para una reserva, opcionalmente filtrando por zona específica
  const loadAssignableTables = async (reservationId: number, zoneId: number | null) => {
    setLoadingAssignable(true);
    try {
      const url = zoneId
        ? `/api/tablereservation/${reservationId}/available-tables?zoneId=${zoneId}`
        : `/api/tablereservation/${reservationId}/available-tables`;
      const res = await api.get(url);
      setAssignableTables(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('No se pudieron cargar las mesas disponibles');
      setAssignableTables([]);
    } finally {
      setLoadingAssignable(false);
    }
  };

  // ASSIGN.4: Abrir modal para asignar/reasignar mesa a una reserva
  const openReservationAssignModal = async (r: Reservation) => {
    setAssignModalForReservation(r);
    setAssignableTables([]);
    // Default: la zona que pidió el cliente
    const initialZone = r.requestedZoneId ?? null;
    setAssignableZoneId(initialZone);
    // Cargar lista de zonas (para el selector) si todavía no la tenemos
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
      } catch { /* ignore */ }
    }
    await loadAssignableTables(r.id, initialZone);
  };

  // Cambiar la zona dentro del modal — refresca la lista de mesas
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
      // 1. Asignar mesa
      await api.put(`/api/tablereservation/${reservation.id}/assign-table`, { tableId });
      // 2. Si la reserva era pendiente, también confirmarla (flujo unificado "Aceptar")
      if (!reservation.isConfirmed) {
        await api.put(`/api/tablereservation/${reservation.id}/confirm`);
        toast.success('Reserva aceptada y mesa asignada');
      } else {
        toast.success('Mesa reasignada correctamente');
      }
      closeReservationAssignModal();
      loadReservations();
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Error al asignar mesa';
      toast.error(msg);
    } finally {
      setAssigningTableId(null);
    }
  };

  // RESCHEDULE: abrir modal con la fecha/hora actual de la reserva pre-llenadas
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

  // Mover reserva a la fecha/hora seleccionadas. Si targetDate viene, se usa
  // (caso: click en día del calendario para mover una reserva).
  const submitReschedule = async (reservationOverride?: Reservation, targetDateTime?: string) => {
    const r = reservationOverride ?? rescheduleModalForReservation;
    if (!r) return;
    const newDateTime = targetDateTime ?? `${rescheduleDate}T${rescheduleTime}:00`;
    if (!newDateTime || newDateTime.startsWith('T')) {
      toast.error('Fecha y hora son requeridas');
      return;
    }
    setRescheduling(true);
    try {
      const res = await api.put(`/api/tablereservation/${r.id}/reschedule`, { newDateTime });
      const data = res.data;
      if (data?.hasConflict && data?.warning) {
        toast(data.warning, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success('Reserva reprogramada');
      }
      closeRescheduleModal();
      setCalendarDaySelected(null);
      loadReservations();
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Error al reprogramar reserva';
      toast.error(msg);
    } finally {
      setRescheduling(false);
    }
  };

  // Modal de confirmación al cancelar/rechazar una reserva
  const [cancelConfirmReservation, setCancelConfirmReservation] = useState<Reservation | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState(false);

  const requestCancelReservation = (r: Reservation) => {
    setCancelConfirmReservation(r);
  };

  const confirmCancelReservation = async () => {
    if (!cancelConfirmReservation) return;
    setCancellingReservation(true);
    try {
      await api.put(`/api/tablereservation/${cancelConfirmReservation.id}/cancel`);
      toast.success(cancelConfirmReservation.isConfirmed ? 'Reserva cancelada' : 'Reserva rechazada');
      setCancelConfirmReservation(null);
      loadReservations();
      loadData();
    } catch {
      toast.error('Error al cancelar reserva');
    } finally {
      setCancellingReservation(false);
    }
  };

  // SignalR for real-time reservation notifications
  useEffect(() => {
    const token = localStorage.getItem('host_token');
    if (!token) return;

    // Usar URL relativa para que el rewrite de Next.js haga proxy al backend (evita problemas de certificado autofirmado)
    const hubUrl = '/hubs/reservations';

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        skipNegotiation: false,
        // El proxy same-origin de Next (/hubs/* → backend) no actualiza WebSockets,
        // por lo que el intento de WS fallaba siempre y ensuciaba la consola con
        // "WebSocket failed to connect". LongPolling es el transporte fiable a través
        // del rewrite; el polling de respaldo (5-30s) cubre cualquier caída de RT.
        transport: signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on('NewReservation', (data: any) => {
      toast((t) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Nueva reserva del Portal</p>
            <p className="text-xs text-gray-500">{data.customerName} · {data.numberOfGuests} personas · Mesa {data.tableNumber}</p>
          </div>
          <button onClick={() => { toast.dismiss(t.id); setActiveView('reservations'); }} className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg font-semibold hover:bg-purple-700">
            Ver
          </button>
        </div>
      ), { duration: 15000, style: { maxWidth: '420px' } });

      setPendingAlert(prev => prev + 1);
      loadReservations();

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SmartMenu — Nueva Reserva', {
          body: `${data.customerName} quiere reservar para ${data.numberOfGuests} personas`,
          icon: '/favicon.ico',
        });
      }
    });

    connection.on('ReservationConfirmed', () => loadReservations());
    connection.on('ReservationCancelled', () => loadReservations());

    connection.start().then(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }).catch(err => console.warn('SignalR reservations connection failed:', err));

    return () => {
      connection.stop().catch(() => {});
      connectionRef.current = null;
    };
  }, [loadReservations]);

  useEffect(() => {
    // Auth check
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

    const interval = setInterval(loadData, 5000);
    const reservInterval = setInterval(loadReservations, 30000);
    return () => { clearInterval(interval); clearInterval(reservInterval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CAL-FE FEATURE 1 — al abrir el modal o cambiar la fecha, recargar ocupación
  useEffect(() => {
    if (!showOccupancyModal) return;
    loadOccupancy(occupancyDate);
  }, [showOccupancyModal, occupancyDate, loadOccupancy]);

  // CAL-FE FEATURE 2 — día efectivo para slots de mesa: deriva del filtro temporal activo (o "hoy")
  const slotsDay = useMemo<string>(() => {
    const now = new Date();
    const fmt = (d: Date) => d.toLocaleDateString('sv-SE');
    if (filterTime === 'tomorrow') {
      return fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    }
    if (filterTime === 'custom' && filterTimeFrom) {
      return filterTimeFrom;
    }
    // 'any' | 'today' | 'week' → hoy por defecto
    return fmt(now);
  }, [filterTime, filterTimeFrom]);

  // CAL-FE FEATURE 2 — cargar slots libres por mesa para el día efectivo (recarga al cambiar el día)
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
        // Degradar con elegancia: sin slots no rompe el render de las tarjetas
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
      toast.error('Esta mesa no está disponible');
      return;
    }
    setSelectedTable(table);
    setNumberOfGuests('');
    setSpecialNotes('');
    setShowAssignModal(true);
  };

  const assignTable = async () => {
    if (!selectedTable || !numberOfGuests) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      await api.post('/api/tablesession', {
        tableId: selectedTable.id,
        numberOfGuests: parseInt(numberOfGuests),
        hostId: user?.id,
        specialNotes
      });

      toast.success('Mesa asignada exitosamente');
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      toast.error('Error al asignar mesa');
    }
  };

  const openReservationModal = (table: Table) => {
    setSelectedTable(table);
    setShowReservationModal(true);
    // El wizard (HostReservationWizard) maneja su propio estado; aquí solo
    // precargamos el menú para el paso de pre-orden.
    if (menuDishes.length === 0) {
      api.get('/api/dish').then(res => setMenuDishes(Array.isArray(res.data) ? res.data : [])).catch(() => {});
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
      case 'Available': return 'Disponible';
      case 'Occupied': return 'Ocupada';
      case 'Reserved': return 'Reservada';
      case 'Billing': return 'Por cobrar';
      case 'Cleaning': return 'Limpieza';
      default: return status;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('host_token');
    localStorage.removeItem('host_user');
    window.location.href = '/login';
  };

  // HOST-MESAS-FILTRO.1 — Resolver el rango [from, to] del filtro temporal en runtime
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
      // Próximos 7 días desde HOY (inclusive)
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
      return { from, to };
    }
    if (filterTime === 'custom' && filterTimeFrom && filterTimeTo) {
      return { from: new Date(filterTimeFrom + 'T00:00:00'), to: new Date(filterTimeTo + 'T23:59:59') };
    }
    return null;
  }, [filterTime, filterTimeFrom, filterTimeTo]);

  // Mapa tableId → array de reservas en el rango actual (calc 1 vez por tick)
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
      // HOST-MESAS-FILTRO.1 — si hay filtro temporal activo, solo mesas con reserva en ese rango
      const timeMatch = !timeRange || (reservationsByTableInRange.get(t.id)?.length ?? 0) > 0;
      return zoneMatch && statusMatch && capacityMatch && timeMatch;
    });
  }, [tables, selectedZone, zones, filterStatus, filterCapacity, timeRange, reservationsByTableInRange]);

  // Conteo de reservas por zona en el rango actual (para mostrar en chips)
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

  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const availableSeats = tables.filter(t => t.status === 'Available').reduce((sum, t) => sum + t.capacity, 0);
  const occupiedSeats = totalCapacity - availableSeats;

  const today = new Date().toLocaleDateString('sv-SE');
  const todayReservations = reservations.filter(r => {
    const dt = r.reservationDateTime;
    if (!dt) return false;
    return new Date(dt).toLocaleDateString('sv-SE') === today;
  });
  const pendingReservations = todayReservations.filter(r => !r.isConfirmed);
  const confirmedReservations = todayReservations.filter(r => r.isConfirmed);

  // All reservations filtered by status (for the grouped-by-date view)
  const statusFiltered = reservationFilter === 'pending'
    ? reservations.filter(r => !r.isConfirmed)
    : reservationFilter === 'confirmed'
    ? reservations.filter(r => r.isConfirmed)
    : reservations;

  // Filtro DESDE→HASTA (YYYY-MM-DD) combinable con el status
  const dateFiltered = (!dateFrom && !dateTo)
    ? statusFiltered
    : statusFiltered.filter(r => {
        const dKey = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
        if (dateFrom && dKey < dateFrom) return false;
        if (dateTo && dKey > dateTo) return false;
        return true;
      });

  // Filtro de búsqueda (nombre / teléfono / email) — combinable con todo
  const q = searchQuery.trim().toLowerCase();
  const allFiltered = !q
    ? dateFiltered
    : dateFiltered.filter(r => {
        const haystack = `${r.customerName || ''} ${r.customerPhone || ''} ${r.customerEmail || ''}`.toLowerCase();
        return haystack.includes(q);
      });

  const hasActiveReservationFilters = !!dateFrom || !!dateTo || !!q || reservationFilter !== 'all';

  // Contador de ocasiones especiales en el rango filtrado (cumple/aniversario/etc)
  const birthdayCount = allFiltered.filter(r => r.occasionType === 1).length;
  const specialOccasionsCount = allFiltered.filter(r => r.occasionType && r.occasionType !== 0).length;

  const groupedByDate = allFiltered.reduce<Record<string, Reservation[]>>((acc, r) => {
    const key = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // HOST-RESERVAS-ORDER.1 — ordenar reservas dentro de cada fecha: Pendientes > Confirmadas > Canceladas.
  // Las FECHAS se ordenan más abajo: HOY siempre primero, luego futuras (cronológico), luego pasadas.
  Object.keys(groupedByDate).forEach(key => {
    groupedByDate[key].sort((a, b) => {
      const sa = a.isCancelled ? 2 : (a.isConfirmed ? 1 : 0);
      const sb = b.isCancelled ? 2 : (b.isConfirmed ? 1 : 0);
      if (sa !== sb) return sa - sb;
      return new Date(a.reservationDateTime).getTime() - new Date(b.reservationDateTime).getTime();
    });
  });
  const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => {
    // HOY (rank 0) siempre primero; futuras (rank 1) cronológico; pasadas (rank 2) al final, más reciente arriba.
    const ra = a === today ? 0 : (a > today ? 1 : 2);
    const rb = b === today ? 0 : (b > today ? 1 : 2);
    if (ra !== rb) return ra - rb;
    return ra === 2 ? b.localeCompare(a) : a.localeCompare(b);
  });

  const totalPending = reservations.filter(r => !r.isConfirmed).length;
  const totalConfirmed = reservations.filter(r => r.isConfirmed).length;

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
    try { return new Date(dt).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return '-'; }
  };

  const formatDateHeader = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  };

  const isPastDate = (dateStr: string) => dateStr < today;

  if (loading || !mounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Host App</h1>
                <p className="text-sm text-slate-400">
                  Bienvenido, {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : (user?.name ?? user?.email ?? '')}
                </p>
              </div>
              {/* View Tabs */}
              <div className="flex rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <button
                  onClick={() => setActiveView('tables')}
                  className={`px-5 py-2 text-sm font-semibold transition-all ${
                    activeView === 'tables'
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Mesas
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
                  Reservas
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
                  Calendario
                </button>
              </div>
            </div>
            {/* Salir — esquina superior derecha (fila 1) */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
          {/* Fila 2: indicadores de estado, centrados */}
          <div className="hidden md:flex flex-wrap items-center justify-center gap-2 mt-4">
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(t => t.status === 'Available').length}</p>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mt-0.5">Libres</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(t => t.status === 'Occupied').length}</p>
                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mt-0.5">Ocupadas</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(t => t.status === 'Billing').length}</p>
                  <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mt-0.5">Por cobrar</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{tables.filter(t => t.status === 'Reserved').length}</p>
                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mt-0.5">Reservadas</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[80px]">
                  <p className="text-2xl font-black text-white leading-none">{availableSeats}</p>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Asientos libres</p>
                </div>
          </div>
        </div>
      </div>

      {/* ════════ CALENDAR VIEW ════════ */}
      {activeView === 'calendar' && (
        <CalendarView
          reservations={reservations}
          onDayClick={(dateKey) => setCalendarDaySelected(dateKey)}
        />
      )}

      {/* ════════ RESERVATIONS VIEW ════════ */}
      {activeView === 'reservations' && (
        <div className="max-w-5xl mx-auto px-6 pt-5 pb-10">
          {/* Stats row — del DÍA actual (no sistema). Usa las variables day-scoped pre-computadas. */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center border-l-4 border-l-slate-400">
              <p className="text-3xl font-black text-slate-700">{todayReservations.length}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Total · Hoy</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center border-l-4 border-l-amber-400">
              <p className="text-3xl font-black text-slate-700">{pendingReservations.length}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Pendientes · Hoy</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center border-l-4 border-l-emerald-400">
              <p className="text-3xl font-black text-slate-700">{confirmedReservations.length}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Confirmadas · Hoy</p>
            </div>
          </div>

          {/* Filter tabs + filtro de fecha inline (ASSIGN-DATE-FILTER) */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {([
              { key: 'all', label: 'Todas' },
              { key: 'pending', label: 'Pendientes' },
              { key: 'confirmed', label: 'Confirmadas' },
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

            {/* Búsqueda + Filtro DESDE→HASTA + contador cumpleaños — alineados a la derecha */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* Buscar por cliente */}
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
                  placeholder="Buscar cliente..."
                  aria-label="Buscar reserva por nombre, teléfono o email"
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
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro DESDE→HASTA */}
              <div className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 border transition-all ${
                (dateFrom || dateTo) ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 'bg-white border-gray-200'
              }`}>
                <Calendar className={`w-4 h-4 ${(dateFrom || dateTo) ? 'text-blue-500' : 'text-slate-400'}`} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Desde"
                  title="Desde"
                  className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                />
                <span className={`text-xs font-bold ${(dateFrom || dateTo) ? 'text-blue-500' : 'text-slate-400'}`}>→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  aria-label="Hasta"
                  title="Hasta"
                  className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-slate-400 hover:text-red-600 transition-colors p-0.5"
                    aria-label="Limpiar rango"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Badge cumpleaños del rango filtrado — estilo sobrio */}
              {birthdayCount > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm"
                  title={`${birthdayCount} cumpleaños en el rango filtrado`}
                >
                  <span className="text-base leading-none">🎂</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{birthdayCount}</span>
                  <span className="text-xs font-medium text-slate-500">
                    {birthdayCount === 1 ? 'cumpleaños' : 'cumpleaños'}
                  </span>
                </div>
              )}
              {specialOccasionsCount > birthdayCount && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm"
                  title={`${specialOccasionsCount - birthdayCount} otras ocasiones especiales (aniversarios, romántica, etc.)`}
                >
                  <span className="text-base leading-none">✨</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{specialOccasionsCount - birthdayCount}</span>
                  <span className="text-xs font-medium text-slate-500">
                    {specialOccasionsCount - birthdayCount === 1 ? 'ocasión' : 'ocasiones'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Reservations grouped by date */}
          {sortedDateKeys.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              {hasActiveReservationFilters ? (
                <>
                  <Search className="w-14 h-14 text-blue-200 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-slate-700">Sin resultados</p>
                  <p className="text-sm text-slate-500 mt-1">
                    No encontramos reservas que coincidan con los filtros activos.
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
                    Limpiar todos los filtros
                  </button>
                </>
              ) : (
                <>
                  <Inbox className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-slate-600">Aún no hay reservas</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Cuando lleguen reservas del portal o las crees aquí, aparecerán en esta lista.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDateKeys.map(dateKey => (
                <div key={dateKey}>
                  {/* Date header */}
                  <div className={`flex items-center gap-3 mb-3 px-1 ${isPastDate(dateKey) ? 'opacity-60' : ''}`}>
                    <CalendarCheck className={`w-4 h-4 ${dateKey === today ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold capitalize ${dateKey === today ? 'text-blue-600' : 'text-slate-600'}`}>
                      {dateKey === today ? 'Hoy — ' : ''}{formatDateHeader(dateKey)}
                    </span>
                    <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                      {groupedByDate[dateKey].length} reserva{groupedByDate[dateKey].length !== 1 ? 's' : ''}
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
                                      <Globe className="w-3 h-3" />Portal
                                    </span>
                                  )}
                                  {isPending ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      <Clock className="w-3 h-3 text-amber-500" />Pendiente
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      <CheckCircle className="w-3 h-3 text-emerald-500" />Confirmada
                                    </span>
                                  )}
                                  {isUpcoming && r.isConfirmed && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                      Próxima
                                    </span>
                                  )}
                                  {/* Badge de tipo de ocasión (si != Casual) */}
                                  {r.occasionType !== undefined && r.occasionType !== 0 && OCCASION_LABELS[r.occasionType] ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${OCCASION_LABELS[r.occasionType].color}`}
                                      title={`Ocasión: ${OCCASION_LABELS[r.occasionType].label}`}
                                    >
                                      <span>{OCCASION_LABELS[r.occasionType].icon}</span>
                                      {OCCASION_LABELS[r.occasionType].label}
                                    </span>
                                  ) : null}
                                </div>

                                {/* Contacto del cliente: el botón "Contactar" se movió a la columna de acciones (debajo de "Mover") */}

                                {/* 2️⃣ Datos de la reserva */}
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reserva</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="font-semibold">{formatReservationTime(r.reservationDateTime)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{r.numberOfGuests} {r.numberOfGuests === 1 ? 'persona' : 'personas'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                    {r.tableId && r.tableNumber ? (
                                      <span>Mesa {r.tableNumber} · {r.zoneName}</span>
                                    ) : (
                                      <span className="text-amber-600 font-medium">
                                        Sin mesa · {r.requestedZoneName || r.zoneName || 'Sin zona'}
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
                                    Pre-orden ({preOrder.items.length} plato{preOrder.items.length !== 1 ? 's' : ''})
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>

                              {/* Acciones — todos del mismo tamaño (w-full en columna de ancho fijo) */}
                              <div className="flex flex-col gap-2 flex-shrink-0 ml-auto w-[210px]">
                                {isPending ? (
                                  // Pendiente: Aceptar y Rechazar JUNTOS en la misma línea
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => openReservationAssignModal(r)}
                                      className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Aceptar
                                    </button>
                                    <button
                                      onClick={() => requestCancelReservation(r)}
                                      className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      Rechazar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => requestCancelReservation(r)}
                                    className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Cancelar
                                  </button>
                                )}
                                {/* Solo confirmadas: botón Reasignar (las pendientes asignan vía Aceptar) */}
                                {!isPending && (
                                  <button
                                    onClick={() => openReservationAssignModal(r)}
                                    className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                  >
                                    <CalendarCheck className="w-4 h-4" />
                                    Reasignar mesa
                                  </button>
                                )}
                                {/* Mover y Contactar JUNTOS en la misma línea */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openRescheduleModal(r)}
                                    className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-white hover:bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold transition-colors shadow-sm border-2 border-blue-300"
                                    title="Mover a otra fecha u hora"
                                  >
                                    <Calendar className="w-4 h-4" />
                                    Mover
                                  </button>
                                  {(r.customerPhone || r.customerEmail) && (
                                    <button
                                      onClick={() => setContactReservation(r)}
                                      className="flex items-center justify-center gap-1 flex-1 px-2 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-semibold transition-colors border-2 border-blue-200"
                                      title="Ver datos de contacto"
                                    >
                                      <Phone className="w-4 h-4" />
                                      Contactar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Pre-order expandible */}
                            {isExpanded && preOrder && preOrder.items.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pre-orden de platos</p>
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
                                    <p className="text-xs text-slate-400 mt-2 italic">Nota: {preOrder.notes}</p>
                                  )}
                                  <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-gray-100 mt-1">
                                    <span className="text-slate-600">Total pre-orden</span>
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

      {/* ════════ TABLES VIEW ════════ */}
      {activeView === 'tables' && <>
      {/* Filters Panel */}
      <div className="max-w-7xl mx-auto px-6 pt-5 pb-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">

          {/* Zone tabs */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Zona</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedZone(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedZone === null
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todas
                {timeRange && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    selectedZone === null ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {Array.from(reservationsByTableInRange.values()).reduce((s, a) => s + a.length, 0)} res
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
                      // HOST-MESAS-FILTRO.1: mostrar conteo de reservas en el rango
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                        selectedZone === zone.id ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {reservasEnZona} res
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

          {/* HOST-MESAS-FILTRO.1 — Filtro temporal de reservas */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Reservas
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 'any',      label: 'Cualquier momento' },
                { value: 'today',    label: 'Hoy' },
                { value: 'tomorrow', label: 'Mañana' },
                { value: 'week',     label: 'Esta semana' },
                { value: 'custom',   label: 'Personalizado' },
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
              {/* Date pickers — visibles solo en modo 'custom' */}
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
              {/* Resumen del rango activo */}
              {timeRange && (
                <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                  {timeRange.from.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                  {timeRange.from.toDateString() !== timeRange.to.toDateString() && (
                    <> → {timeRange.to.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</>
                  )}
                </span>
              )}

              {/* CAL-FE FEATURE 1 — abrir modal calendario + ocupación por bloque */}
              <button
                onClick={() => {
                  // Sembrar la fecha del modal con el día efectivo del filtro actual
                  setOccupancyDate(slotsDay);
                  const [yy, mm] = slotsDay.split('-').map(Number);
                  setOccMonth(new Date(yy, (mm || 1) - 1, 1));
                  setShowOccupancyModal(true);
                }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 shadow-sm transition-all"
                title="Ver el día y su ocupación por bloque horario"
              >
                <Calendar className="w-3.5 h-3.5" />
                Ver día / ocupación
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Status + Capacity row */}
          <div className="flex flex-wrap items-end gap-6">

            {/* Estado */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'Todos', dot: null },
                  { value: 'Available', label: 'Disponible', dot: 'bg-green-500' },
                  { value: 'Occupied', label: 'Ocupada', dot: 'bg-red-500' },
                  { value: 'Billing', label: 'Por cobrar', dot: 'bg-violet-500' },
                  { value: 'Reserved', label: 'Reservada', dot: 'bg-yellow-400' },
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

            {/* Capacidad */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Capacidad</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'Todas', icon: null },
                  { value: '2', label: '1–2 personas', icon: '🪑' },
                  { value: '4', label: '3–4 personas', icon: '🪑🪑' },
                  { value: '6+', label: '5+ personas', icon: '🪑🪑🪑' },
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

            {/* Results + clear */}
            <div className="ml-auto flex items-center gap-3">
              {(hasActiveFilters || selectedZone !== null) && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all border border-gray-200 hover:border-red-200"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 leading-none">{filteredTables.length}</p>
                <p className="text-xs text-gray-400">mesa{filteredTables.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Grid — responsive: 1col cell portrait → 2col cell landscape → 3col tablet → 5col desktop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredTables.map((table) => (
            <div
              key={table.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
            >
              {/* Color strip */}
              <div className={`h-1.5 w-full ${getStatusStrip(table.status)}`} />

              <div className="p-4 flex flex-col flex-1">
                {/* Number + badge */}
                <div className="flex items-start justify-between mb-3">
                  <span className="text-4xl font-black text-slate-900 leading-none">
                    {table.tableNumber}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${getStatusBadge(table.status)}`}>
                    {getStatusLabel(table.status)}
                  </span>
                </div>

                {/* Zone + Capacity */}
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest truncate">{table.zoneName}</p>
                <div className="flex items-center gap-1 mt-1 text-slate-500">
                  <Users className="w-3 h-3" />
                  <span className="text-xs">{table.capacity} personas</span>
                </div>

                {/* CAL-FE FEATURE 2 — Horarios libres de la mesa para el día efectivo (badges + "+N más") */}
                {(() => {
                  const slots = tableSlots[table.id];
                  // Aún cargando y sin datos previos → placeholder sutil (no bloquea el render)
                  if (slots === undefined) {
                    return tableSlotsLoading ? (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3 animate-pulse" />
                        <span className="animate-pulse">Cargando horarios…</span>
                      </div>
                    ) : null;
                  }
                  if (slots.length === 0) {
                    return (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                        <Clock className="w-3 h-3" />
                        Sin horarios libres
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
                        Horarios libres ({slots.length})
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
                            +{extra} más
                          </button>
                        )}
                        {isOpen && extra > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOpenSlotsTableId(null); }}
                            className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold leading-none hover:bg-slate-200 transition-colors"
                          >
                            Menos
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* HOST-MESAS-FILTRO.1 — badge de reservas en el rango */}
                {timeRange && (() => {
                  const rsv = reservationsByTableInRange.get(table.id) ?? [];
                  if (rsv.length === 0) return null;
                  const earliest = rsv.slice().sort((a, b) =>
                    new Date(a.reservationDateTime).getTime() - new Date(b.reservationDateTime).getTime()
                  )[0];
                  const dt = new Date(earliest.reservationDateTime);
                  const dayLabel = dt.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
                  const timeLabel = dt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-blue-900 leading-tight">
                          {rsv.length} reserva{rsv.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-[10px] text-blue-700 truncate">
                          Próx: {dayLabel} · {timeLabel}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* HOST-MESAS-UX.1 — Sección reserva + walk-in actions, diseño táctil tablet/cell */}
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

                  // Caso 1: mesa físicamente ocupada → solo estado (no actionable)
                  if (isPhysicallyBusy) {
                    return (
                      <div className="mt-auto pt-3">
                        {table.status === 'Billing' ? (
                          <div className="w-full py-3 px-2 rounded-xl text-center bg-violet-50 border border-violet-200">
                            <p className="text-xs font-bold text-violet-700 leading-tight">Proceso de cobro</p>
                            <p className="text-[10px] text-violet-500 mt-0.5">Liberándose pronto</p>
                          </div>
                        ) : (
                          <div className={`w-full py-3 rounded-xl text-xs font-semibold text-center ${
                            table.status === 'Occupied' ? 'bg-red-50 text-red-500'
                            : 'bg-blue-50 text-blue-500'
                          }`}>
                            {table.status === 'Occupied' ? 'En uso' : 'En limpieza'}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Caso 2: mesa con reserva próxima → gestión de reserva como acción principal
                  if (hasReserva) {
                    const r = tableReservas[0];
                    const isPending = !r.isConfirmed;
                    const extra = tableReservas.length - 1;
                    const dt = new Date(r.reservationDateTime);
                    const now = new Date();
                    const hoursUntil = (dt.getTime() - now.getTime()) / 3600000;
                    const dayLabel = dt.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
                    const timeLabel = dt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
                    const dayLong = dt.toLocaleDateString('es-DO', { weekday: 'short' }).replace('.', '');
                    // Si la reserva es lejana (>2h), permite walk-in. Si ya está cerca, mejor no.
                    const allowWalkIn = hoursUntil > 2;

                    return (
                      <div className="mt-3 flex flex-col flex-1">
                        {/* Bloque de reserva — más claro y respirado */}
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
                            <span className="text-slate-500">{r.numberOfGuests} {r.numberOfGuests === 1 ? 'persona' : 'personas'}</span>
                          </p>
                        </div>

                        {/* Acción primaria — full width, alta para tap */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openReservationAssignModal(r); }}
                          className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-colors ${
                            isPending ? 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700' : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                          }`}
                        >
                          {isPending ? (
                            <><CheckCircle className="w-4 h-4" /> Aceptar reserva</>
                          ) : (
                            <><CalendarCheck className="w-4 h-4" /> Reasignar mesa</>
                          )}
                        </button>

                        {/* Acciones secundarias — 50/50 con icon + texto chico */}
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); requestCancelReservation(r); }}
                            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100 text-[11px] font-semibold transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {isPending ? 'Rechazar' : 'Cancelar'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openRescheduleModal(r); }}
                            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 active:bg-blue-100 text-[11px] font-semibold transition-colors"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Mover
                          </button>
                        </div>

                        {/* +N más reservas */}
                        {extra > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setTableReservasModal({ table, reservas: tableReservas }); }}
                            className="mt-1.5 w-full py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded transition-colors flex items-center justify-center gap-1"
                          >
                            <ChevronDown className="w-3 h-3" />
                            Ver {extra} reserva{extra !== 1 ? 's' : ''} más
                          </button>
                        )}

                        {/* Walk-in — separador sutil + texto, solo si la reserva está lejos */}
                        {allowWalkIn && (
                          <>
                            <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                              <p className="text-[9px] text-slate-400 uppercase tracking-wider text-center mb-1.5">
                                o cliente walk-in
                              </p>
                              <button
                                onClick={() => openAssignModal(table)}
                                className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-[11px] font-semibold transition-colors"
                              >
                                Asignar ahora
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }

                  // Caso 3: mesa libre sin reservas → flujo simple
                  return (
                    <div className="mt-auto pt-3 space-y-2">
                      <button
                        onClick={() => openAssignModal(table)}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                      >
                        Asignar
                      </button>
                      <button
                        onClick={() => openReservationModal(table)}
                        className="w-full py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                      >
                        Reservar
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>

      </>}

      {/* ════════ CAL-FE FEATURE 1 — Modal Calendario + Ocupación por bloque ════════ */}
      {showOccupancyModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowOccupancyModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Ocupación del día
                </p>
                <h2 className="text-lg font-bold text-white capitalize">
                  {(() => {
                    const [y, m, d] = occupancyDate.split('-').map(Number);
                    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                  })()}
                </h2>
              </div>
              <button
                onClick={() => setShowOccupancyModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-red-500/80 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body — calendario + desglose */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* (a) Calendario interactivo (patrón del mini-calendario, tema azul) */}
                <div className="border border-gray-200 rounded-xl p-3 bg-white h-fit">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => setOccMonth(mo => new Date(mo.getFullYear(), mo.getMonth() - 1, 1))}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      aria-label="Mes anterior"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <p className="text-sm font-bold capitalize text-slate-700">
                      {occMonth.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOccMonth(mo => new Date(mo.getFullYear(), mo.getMonth() + 1, 1))}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      aria-label="Mes siguiente"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {['D','L','M','M','J','V','S'].map((d, i) => (
                      <span key={i} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {(() => {
                      const year = occMonth.getFullYear();
                      const month = occMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const todayYMD = new Date().toLocaleDateString('sv-SE');
                      const cells: React.ReactNode[] = [];
                      for (let i = 0; i < firstDay; i++) cells.push(<div key={`b${i}`} />);
                      for (let d = 1; d <= daysInMonth; d++) {
                        const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isPast = ymd < todayYMD;
                        const isToday = ymd === todayYMD;
                        const isSelected = ymd === occupancyDate;
                        cells.push(
                          <button
                            key={ymd}
                            type="button"
                            disabled={isPast}
                            onClick={() => setOccupancyDate(ymd)}
                            className={[
                              'h-9 w-full text-sm rounded-md transition-colors',
                              isPast
                                ? 'text-slate-300 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                                  : isToday
                                    ? 'bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-300'
                                    : 'text-slate-700 hover:bg-blue-50',
                            ].join(' ')}
                          >
                            {d}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        const t = new Date();
                        setOccupancyDate(t.toLocaleDateString('sv-SE'));
                        setOccMonth(new Date(t.getFullYear(), t.getMonth(), 1));
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Ir a hoy
                    </button>
                  </div>
                </div>

                {/* (b) Desglose de ocupación por bloque, agrupado por turno */}
                <div className="min-h-[200px]">
                  {occLoading ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
                      <p className="text-sm">Cargando ocupación…</p>
                    </div>
                  ) : occError ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                      <XCircle className="w-10 h-10 text-red-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No se pudo cargar la ocupación</p>
                      <button
                        onClick={() => loadOccupancy(occupancyDate)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 rounded-lg"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : !occupancyData || occupancyData.blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                      <Inbox className="w-10 h-10 text-gray-200 mb-2" />
                      <p className="text-sm font-semibold text-slate-500">Sin bloques de servicio</p>
                      <p className="text-xs text-slate-400 mt-1">No hay disponibilidad configurada para este día.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const windows = occupancyData.serviceWindows.length > 0
                          ? occupancyData.serviceWindows
                          : [{ label: 'Servicio', start: '00:00', end: '23:59' }];
                        // Agrupar bloques por ventana; los que no encajen → "Otros" (no se pierden)
                        const used = new Set<string>();
                        const groups = windows.map(w => {
                          const blocks = occupancyData.blocks.filter(b => {
                            const within = b.time >= w.start && b.time <= w.end;
                            if (within) used.add(b.time);
                            return within;
                          });
                          return { label: w.label, blocks };
                        }).filter(g => g.blocks.length > 0);
                        const leftover = occupancyData.blocks.filter(b => !used.has(b.time));
                        if (leftover.length > 0) groups.push({ label: 'Otros', blocks: leftover });

                        const statusStyle = (s: OccupancyBlock['status']) => {
                          switch (s) {
                            case 'available': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            case 'limited':   return 'bg-amber-50 text-amber-700 border-amber-200';
                            case 'full':      return 'bg-red-50 text-red-700 border-red-200';
                            default:          return 'bg-slate-50 text-slate-600 border-slate-200';
                          }
                        };

                        return groups.map(g => (
                          <div key={g.label}>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{g.label}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {g.blocks.map(b => (
                                <div
                                  key={b.time}
                                  className={`rounded-lg border px-2 py-1.5 text-center ${statusStyle(b.status)}`}
                                  title={`${b.reservations}/${b.maxReservations} reservas · ${b.covers}/${b.maxCovers} cubiertos`}
                                >
                                  <p className="text-sm font-bold tabular-nums leading-none">{to12h(b.time)}</p>
                                  <p className="text-[11px] font-semibold tabular-nums mt-0.5">
                                    {b.maxCovers > 0 ? `${b.covers}/${b.maxCovers}` : `${b.covers}`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}

                      {/* Leyenda de colores */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 border-t border-gray-100">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Disponible</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Limitado</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Lleno</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — azul = acción principal, rojo = cancelar */}
            <div className="bg-slate-50 px-5 py-3 border-t flex items-center justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => setShowOccupancyModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // Aplicar el filtro de reservas del host a este día (modo 'custom' = rango de 1 día)
                  setFilterTime('custom');
                  setFilterTimeFrom(occupancyDate);
                  setFilterTimeTo(occupancyDate);
                  setShowOccupancyModal(false);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CalendarCheck className="w-4 h-4" />
                Ver este día
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOST-MESAS-RESERVAS.2 — Mini-modal: TODAS las reservas de una mesa con sus acciones */}
      {tableReservasModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setTableReservasModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-indigo-600 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4" />
                  Mesa #{tableReservasModal.table.tableNumber}
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  {tableReservasModal.table.zoneName} · {tableReservasModal.reservas.length} reservas
                </p>
              </div>
              <button onClick={() => setTableReservasModal(null)} className="p-1.5 hover:bg-white/10 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lista de reservas con todas sus acciones (tamaño normal aquí, hay espacio) */}
            <div className="overflow-y-auto px-4 py-3 space-y-2.5 flex-1">
              {tableReservasModal.reservas.map(r => {
                const isPending = !r.isConfirmed;
                const dt = new Date(r.reservationDateTime);
                const dayLabel = dt.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
                const timeLabel = dt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={r.id}
                    className={`rounded-lg p-3 border-l-4 ${
                      isPending ? 'bg-amber-50 border-amber-400' : 'bg-emerald-50 border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-bold text-sm text-slate-900 truncate">{r.customerName}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isPending ? 'Pendiente' : 'Confirmada'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 mb-2.5">
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dayLabel} · {timeLabel} · {r.numberOfGuests} pers
                      </p>
                      {r.customerPhone && (
                        <a
                          href={`tel:${r.customerPhone}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          Contactar
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {isPending ? (
                        <button
                          onClick={() => { openReservationAssignModal(r); setTableReservasModal(null); }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs font-semibold"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Aceptar
                        </button>
                      ) : (
                        <button
                          onClick={() => { openReservationAssignModal(r); setTableReservasModal(null); }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-semibold"
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                          Reasignar
                        </button>
                      )}
                      <button
                        onClick={() => { requestCancelReservation(r); setTableReservasModal(null); }}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs font-semibold"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {isPending ? 'Rechazar' : 'Cancelar'}
                      </button>
                      <button
                        onClick={() => { openRescheduleModal(r); setTableReservasModal(null); }}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-white border-2 border-blue-300 text-blue-600 hover:bg-blue-50 rounded-md text-xs font-semibold"
                        title="Mover a otra fecha"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-50 px-4 py-2.5 border-t flex justify-end">
              <button
                onClick={() => setTableReservasModal(null)}
                className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Asignar</p>
                <h2 className="text-xl font-bold text-white">Mesa #{selectedTable.tableNumber}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedTable.zoneName} · hasta {selectedTable.capacity} personas</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Número de Personas *
                </label>
                <input
                  type="number"
                  value={numberOfGuests}
                  onChange={(e) => setNumberOfGuests(e.target.value)}
                  max={selectedTable.capacity}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900"
                  placeholder={`Máximo ${selectedTable.capacity}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Notas Especiales
                </label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 resize-none"
                  rows={3}
                  placeholder="Ocasión especial, preferencias, alergias..."
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button onClick={assignTable} className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 text-sm font-semibold transition-colors shadow-sm">
                  Asignar Mesa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Modal */}
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

      {/* Modal de confirmación al cancelar/rechazar reserva */}
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
                {cancelConfirmReservation.isConfirmed ? '¿Cancelar reserva?' : '¿Rechazar reserva?'}
              </h3>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                {cancelConfirmReservation.isConfirmed
                  ? 'Esta reserva ya estaba confirmada. Al cancelar se notificará a los demás staff y se liberará la mesa si aplica.'
                  : 'La reserva volverá al cliente como rechazada. Esta acción no se puede deshacer.'}
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
                    {cancelConfirmReservation.numberOfGuests} {cancelConfirmReservation.numberOfGuests === 1 ? 'persona' : 'personas'}
                    {cancelConfirmReservation.tableId && cancelConfirmReservation.tableNumber && (
                      <> · Mesa {cancelConfirmReservation.tableNumber} · {cancelConfirmReservation.zoneName}</>
                    )}
                    {!cancelConfirmReservation.tableId && (
                      <> · {cancelConfirmReservation.requestedZoneName || cancelConfirmReservation.zoneName || 'Sin zona'} · sin mesa asignada</>
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
                No, mantener
              </button>
              <button
                onClick={confirmCancelReservation}
                disabled={cancellingReservation}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {cancellingReservation ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    {cancelConfirmReservation.isConfirmed ? 'Sí, cancelar' : 'Sí, rechazar'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE: Modal mover reserva a otra fecha/hora */}
      {/* Modal: datos de contacto del cliente (teléfono + correo) */}
      {contactReservation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setContactReservation(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Contacto</p>
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
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">Teléfono</p>
                      <p className="text-slate-900 font-semibold truncate">{contactReservation.customerPhone}</p>
                    </div>
                  </div>
                  <a href={`tel:${contactReservation.customerPhone}`} className="flex-shrink-0 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold">Llamar</a>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin teléfono registrado</p>
              )}
              {contactReservation.customerEmail ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">Correo</p>
                      <p className="text-slate-900 font-semibold truncate">{contactReservation.customerEmail}</p>
                    </div>
                  </div>
                  <a href={`mailto:${contactReservation.customerEmail}`} className="flex-shrink-0 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold">Enviar</a>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin correo registrado</p>
              )}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setContactReservation(null)} className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-gray-50">Cerrar</button>
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
                  Mover reserva
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
                <p className="text-xs text-slate-500 mb-1">Fecha y hora actuales</p>
                <p className="font-semibold text-slate-700">
                  {new Date(rescheduleModalForReservation.reservationDateTime).toLocaleString('es-DO', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Nueva fecha
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
                    <Clock className="w-3 h-3" /> Nueva hora
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
                  <p className="text-xs text-blue-600 mb-1">Será movida a</p>
                  <p className="font-semibold text-blue-900">
                    {new Date(`${rescheduleDate}T${rescheduleTime}:00`).toLocaleString('es-DO', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
              {rescheduleModalForReservation.tableId && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  ℹ️ La mesa <strong>#{rescheduleModalForReservation.tableNumber}</strong> se mantiene asignada. Si hay conflicto con otra reserva ese día, recibirás un aviso.
                </p>
              )}
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t flex justify-end gap-2">
              <button
                onClick={closeRescheduleModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => submitReschedule()}
                disabled={rescheduling || !rescheduleDate || !rescheduleTime}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {rescheduling ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    Moviendo...
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5" />
                    Confirmar movimiento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE: Modal CalendarDay — al hacer click en día del calendario */}
      {calendarDaySelected && (() => {
        const dayReservas = reservations.filter(r => {
          const k = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
          return k === calendarDaySelected;
        });
        const otherReservas = reservations.filter(r => {
          const k = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
          return k !== calendarDaySelected;
        });
        const dayLabel = new Date(calendarDaySelected + 'T12:00:00').toLocaleDateString('es-DO', {
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
                    {dayReservas.length} reserva{dayReservas.length !== 1 ? 's' : ''} este día
                  </p>
                </div>
                <button onClick={() => setCalendarDaySelected(null)} className="p-1.5 hover:bg-white/10 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">
                {/* Sección 1: Reservas del día */}
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                    Reservas de este día
                  </p>
                  {/* Tabs por ocasión — solo si hay >1 tipo distinto */}
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
                          Todas ({dayReservas.length})
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
                              {meta.label} ({count})
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
                          No hay reservas para este día todavía.
                        </p>
                      );
                    }
                    if (filteredDayReservas.length === 0) {
                      const filterMeta = OCCASION_LABELS[dayModalOccasionFilter as number];
                      return (
                        <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 flex items-center gap-2">
                          <span>Ninguna reserva con ocasión {filterMeta?.icon} <strong>{filterMeta?.label}</strong> este día.</span>
                          <button
                            onClick={() => setDayModalOccasionFilter('all')}
                            className="ml-auto text-blue-600 hover:underline font-semibold text-xs"
                          >
                            Ver todas
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
                                      {occMeta.label}
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
                                {isCancelled ? 'Cancelada' : r.isConfirmed ? 'Confirmada' : 'Pendiente'}
                              </span>
                              {!isCancelled && (
                                <button
                                  onClick={() => openReservationAssignModal(r)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm text-white ${
                                    isPending
                                      ? 'bg-emerald-500 hover:bg-emerald-600'
                                      : 'bg-blue-500 hover:bg-blue-600'
                                  }`}
                                  title={isPending ? 'Aceptar reserva y asignar mesa' : 'Reasignar mesa'}
                                >
                                  {isPending ? (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Aceptar
                                    </>
                                  ) : (
                                    <>
                                      <CalendarCheck className="w-3.5 h-3.5" />
                                      Reasignar
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

                {/* Sección 2: Mover otras reservas a este día */}
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                    Mover una reserva a este día
                  </p>
                  {otherReservas.length === 0 ? (
                    <p className="text-sm text-slate-400 italic bg-slate-50 rounded-lg p-3">
                      No hay otras reservas para mover.
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
                                Actualmente: {new Date(r.reservationDateTime).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}, {formatReservationTime(r.reservationDateTime)}
                                {' '}· 👥 {r.numberOfGuests}
                                {r.tableNumber && ` · Mesa ${r.tableNumber}`}
                              </p>
                            </div>
                            <button
                              onClick={() => submitReschedule(r, newDateTime)}
                              disabled={rescheduling}
                              className="flex-shrink-0 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                            >
                              Mover aquí
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
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ASSIGN.4: Modal de asignación / reasignación de mesa */}
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
                  {assignModalForReservation.isConfirmed ? 'Reasignar mesa' : 'Aceptar reserva'}
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {assignModalForReservation.customerName} · {assignModalForReservation.numberOfGuests} pers · zona pedida:{' '}
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
              {/* Selector de zona */}
              {allZonesForAssign.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
                    Zona
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
                              pedida
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
                  <p className="text-sm text-slate-500">Cargando mesas disponibles...</p>
                </div>
              ) : assignableTables.length === 0 ? (
                <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-900 font-semibold">Sin disponibilidad en esta zona</p>
                  <p className="text-sm text-amber-700 mt-1">
                    No hay mesas con capacidad ≥ {assignModalForReservation.numberOfGuests} libres este día.
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    💡 Prueba otra zona arriba — el cliente puede ser reubicado.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      Mesas disponibles
                    </p>
                    {assignableZoneId !== assignModalForReservation.requestedZoneId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                        Diferente a la zona pedida
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {assignableTables.map((t) => {
                      const disabled = t.isOccupied || assigningTableId !== null;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => !t.isOccupied && assignTableToReservation(t.id)}
                          className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                            t.isCurrent
                              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300'
                              : t.isOccupied
                                ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                                : 'border-blue-200 bg-white hover:border-blue-500 hover:bg-blue-50'
                          }`}
                        >
                          <div className="text-2xl font-bold text-slate-900">
                            Mesa {t.tableNumber}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {t.capacity} pers
                          </div>
                          {t.isCurrent && (
                            <span className="absolute top-1.5 right-1.5 text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                              Actual
                            </span>
                          )}
                          {t.isOccupied && !t.isCurrent && (
                            <span className="absolute top-1.5 right-1.5 text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded-full font-medium">
                              Ocupada
                            </span>
                          )}
                          {assigningTableId === t.id && (
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
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CALENDAR VIEW — Vista mensual con cuenta de reservas por día
   ════════════════════════════════════════════════════════════════ */
function CalendarView({
  reservations,
  onDayClick,
}: {
  reservations: Reservation[];
  onDayClick: (dateKey: string) => void;
}) {
  const today = new Date();
  const todayKey = today.toLocaleDateString('sv-SE');
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Agrupar reservas por día YYYY-MM-DD
  const byDate = reservations.reduce<Record<string, Reservation[]>>((acc, r) => {
    const k = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  // Construir grid del mes: empieza el primer día calendario de la semana
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const dayOfWeekStart = firstDay.getDay(); // 0 = domingo
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  // Pad para que la primera fila empiece en domingo
  const cells: (Date | null)[] = [];
  for (let i = 0; i < dayOfWeekStart; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }
  // Pad final para completar la última fila
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = viewMonth.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  const goToday = () => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  const weekDayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-5 pb-10">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronDown className="w-5 h-5 rotate-90 text-slate-600" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900 capitalize min-w-[200px] text-center">
            {monthName}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronDown className="w-5 h-5 -rotate-90 text-slate-600" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
        >
          Hoy
        </button>
      </div>

      {/* Grid de calendario */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Encabezado días semana */}
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

        {/* Celdas */}
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
                title={total > 0 ? `${total} reserva${total !== 1 ? 's' : ''} — click para filtrar` : 'Sin reservas'}
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
                        {confirmed} confirmada{confirmed !== 1 ? 's' : ''}
                      </div>
                    )}
                    {pending > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                        {pending} pendiente{pending !== 1 ? 's' : ''}
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

      {/* Leyenda */}
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Confirmadas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Pendientes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>🎂</span>
          <span>Cumpleaños</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>✨</span>
          <span>Otras ocasiones</span>
        </div>
        <div className="ml-auto text-slate-400">
          Click en un día con reservas para filtrar la lista
        </div>
      </div>
    </div>
  );
}
