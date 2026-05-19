'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Users, Calendar, LogOut, Plus, X, Clock, Phone, Mail, User, DollarSign, CreditCard, Filter, Bell, CheckCircle, XCircle, CalendarCheck, Globe, UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import * as signalR from '@microsoft/signalr';

const api = axios.create({
  baseURL: '',
});

// S3.3 — JWT refresh interceptor: auto-renueva access_token cuando expira sin
// botar al usuario a /login. Espejo del patrón en admin-panel/waiter-app.
let _refreshPromise: Promise<string | null> | null = null;
async function _tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  const rt = typeof window !== 'undefined' ? localStorage.getItem('host_refresh') : null;
  if (!rt) return null;
  _refreshPromise = (async () => {
    try {
      const r = await axios.post('/api/auth/refresh', { refreshToken: rt });
      const { accessToken, refreshToken: nrt, user } = r.data ?? {};
      if (!accessToken) return null;
      localStorage.setItem('host_token', accessToken);
      if (nrt) localStorage.setItem('host_refresh', nrt);
      if (user) localStorage.setItem('host_user', JSON.stringify(user));
      return accessToken as string;
    } catch { return null; }
    finally { _refreshPromise = null; }
  })();
  return _refreshPromise;
}
api.interceptors.request.use((config) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('host_token') : null;
  if (t && config.headers) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const o: any = error.config;
    if (error.response?.status === 401 && o && !o._refreshAttempted) {
      o._refreshAttempted = true;
      const nt = await _tryRefresh();
      if (nt) {
        o.headers = o.headers ?? {};
        o.headers.Authorization = `Bearer ${nt}`;
        return api.request(o);
      }
      localStorage.removeItem('host_token');
      localStorage.removeItem('host_refresh');
      localStorage.removeItem('host_user');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
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
  numberOfGuests: number;
  reservationDateTime: string;
  isConfirmed: boolean;
  tableNumber: number;
  tableId: number;
  zoneName: string;
  specialRequests?: string;
  source?: string;
  advanceBlockMinutes?: number;
  preOrder?: PreOrder | null;
}

export default function HostApp() {
  const [user, setUser] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // View tabs: 'tables' or 'reservations'
  const [activeView, setActiveView] = useState<'tables' | 'reservations'>('tables');

  // Reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationFilter, setReservationFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [pendingAlert, setPendingAlert] = useState(0);
  const [expandedReservationId, setExpandedReservationId] = useState<number | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCapacity, setFilterCapacity] = useState<string>('all');

  // Assign form
  const [numberOfGuests, setNumberOfGuests] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  // Reservation form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [reservationGuests, setReservationGuests] = useState('');
  const [reservationNotes, setReservationNotes] = useState('');
  const [advanceBlockMinutes, setAdvanceBlockMinutes] = useState('60');
  // Pre-order in reservation
  const [showPreOrder, setShowPreOrder] = useState(false);
  const [menuDishes, setMenuDishes] = useState<any[]>([]);
  const [preOrderItems, setPreOrderItems] = useState<{ dishId: number; name: string; price: number; quantity: number }[]>([]);

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

  const confirmReservation = async (id: number) => {
    try {
      await api.put(`/api/tablereservation/${id}/confirm`);
      toast.success('Reserva aceptada');
      loadReservations();
      loadData();
    } catch {
      toast.error('Error al confirmar reserva');
    }
  };

  const cancelReservation = async (id: number) => {
    if (!confirm('¿Rechazar esta reserva?')) return;
    try {
      await api.put(`/api/tablereservation/${id}/cancel`);
      toast.success('Reserva rechazada');
      loadReservations();
      loadData();
    } catch {
      toast.error('Error al cancelar reserva');
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
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
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
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setReservationDate('');
    setReservationTime('');
    setReservationGuests('');
    setReservationNotes('');
    setAdvanceBlockMinutes('60');
    setShowPreOrder(false);
    setPreOrderItems([]);
    setShowReservationModal(true);
    if (menuDishes.length === 0) {
      api.get('/api/dish').then(res => setMenuDishes(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    }
  };

  const createReservation = async () => {
    if (!selectedTable || !customerName || !customerPhone || !reservationDate || !reservationTime || !reservationGuests) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      // Enviar la fecha/hora exacta que el usuario ingresó, sin convertir a UTC
      // (evita el bug donde 8:30 PM local → 12:30 AM UTC del día siguiente)
      const reservationDateTime = `${reservationDate}T${reservationTime}:00`;

      await api.post('/api/tablereservation', {
        tableId: selectedTable.id,
        customerName,
        customerPhone,
        customerEmail,
        numberOfGuests: parseInt(reservationGuests),
        reservationDateTime,
        specialRequests: reservationNotes,
        hostId: user?.id,
        advanceBlockMinutes: parseInt(advanceBlockMinutes) || 60
      });

      const reservationId = (await api.get('/api/tablereservation')).data?.slice?.(-1)?.[0]?.id;
      if (preOrderItems.length > 0 && reservationId) {
        try {
          await api.post(`/api/tablereservation/${reservationId}/preorder`, {
            notes: reservationNotes || null,
            items: preOrderItems.map(i => ({ dishId: i.dishId, quantity: i.quantity })),
          });
        } catch { /* optional */ }
      }
      toast.success('Reserva creada exitosamente');
      setShowReservationModal(false);
      loadData();
    } catch (error) {
      toast.error('Error al crear reserva');
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

  const capacityOptions = useMemo(() => {
    const caps = [...new Set(tables.map(t => t.capacity))].sort((a, b) => a - b);
    return caps;
  }, [tables]);

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
      return zoneMatch && statusMatch && capacityMatch;
    });
  }, [tables, selectedZone, zones, filterStatus, filterCapacity]);

  const hasActiveFilters = filterStatus !== 'all' || filterCapacity !== 'all';

  const clearFilters = () => {
    setSelectedZone(null);
    setFilterStatus('all');
    setFilterCapacity('all');
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
  const allFiltered = reservationFilter === 'pending'
    ? reservations.filter(r => !r.isConfirmed)
    : reservationFilter === 'confirmed'
    ? reservations.filter(r => r.isConfirmed)
    : reservations;

  const groupedByDate = allFiltered.reduce<Record<string, Reservation[]>>((acc, r) => {
    const key = new Date(r.reservationDateTime).toLocaleDateString('sv-SE');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
  const sortedDateKeys = Object.keys(groupedByDate).sort();

  const totalPending = reservations.filter(r => !r.isConfirmed).length;
  const totalConfirmed = reservations.filter(r => r.isConfirmed).length;

  const formatReservationTime = (dt: string) => {
    try { return new Date(dt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }); }
    catch { return '-'; }
  };

  const formatDateHeader = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  };

  const isPastDate = (dateStr: string) => dateStr < today;

  if (loading) {
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Host App</h1>
                <p className="text-sm text-slate-400">Bienvenido, {user?.name}</p>
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
                  {pendingReservations.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-[10px] font-bold">
                      {pendingReservations.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Stats */}
              <div className="hidden md:flex items-center gap-2 mr-2">
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
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all border border-white/10"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════ RESERVATIONS VIEW ════════ */}
      {activeView === 'reservations' && (
        <div className="max-w-5xl mx-auto px-6 pt-5 pb-10">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
              <p className="text-3xl font-black text-slate-900">{reservations.length}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Total</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-purple-200 p-5 text-center">
              <p className="text-3xl font-black text-purple-600">{totalPending}</p>
              <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mt-1">Pendientes</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-5 text-center">
              <p className="text-3xl font-black text-emerald-600">{totalConfirmed}</p>
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mt-1">Confirmadas</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-5">
            {([
              { key: 'all', label: `Todas (${reservations.length})` },
              { key: 'pending', label: `Pendientes (${totalPending})` },
              { key: 'confirmed', label: `Confirmadas (${totalConfirmed})` },
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
          </div>

          {/* Reservations grouped by date */}
          {sortedDateKeys.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <CalendarCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-lg text-gray-400">No hay reservas</p>
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
                          className={`bg-white rounded-2xl shadow-sm border-2 transition-all ${
                            isPending && isPortal
                              ? 'border-purple-300 bg-purple-50/30'
                              : isPending
                              ? 'border-amber-300 bg-amber-50/30'
                              : isUpcoming
                              ? 'border-emerald-300 bg-emerald-50/30'
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
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      isPortal ? 'bg-purple-100 text-purple-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      <Clock className="w-3 h-3" />Pendiente
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                      <CheckCircle className="w-3 h-3" />Confirmada
                                    </span>
                                  )}
                                  {isUpcoming && r.isConfirmed && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                      Próxima
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="font-semibold">{formatReservationTime(r.reservationDateTime)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{r.numberOfGuests} personas</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Mesa {r.tableNumber} · {r.zoneName}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{r.customerPhone}</span>
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

                              <div className="flex flex-col gap-2 flex-shrink-0">
                                {isPending && (
                                  <button
                                    onClick={() => confirmReservation(r.id)}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Aceptar
                                  </button>
                                )}
                                <button
                                  onClick={() => cancelReservation(r.id)}
                                  className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                >
                                  <XCircle className="w-4 h-4" />
                                  {isPending ? 'Rechazar' : 'Cancelar'}
                                </button>
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
              </button>
              {zones.map((zone) => (
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
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    selectedZone === zone.id ? 'bg-white/25 text-white' : 'bg-white text-gray-500'
                  }`}>
                    {zone.availableTables}/{zone.tableCount}
                  </span>
                </button>
              ))}
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

      {/* Tables Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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

                {/* Actions */}
                <div className="mt-auto pt-3 space-y-1.5">
                  {table.status === 'Available' ? (
                    <>
                      <button
                        onClick={() => openAssignModal(table)}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors"
                      >
                        Asignar
                      </button>
                      <button
                        onClick={() => openReservationModal(table)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Reservar
                      </button>
                    </>
                  ) : table.status === 'Billing' ? (
                    <div className="w-full py-2 px-2 rounded-xl text-center bg-violet-50 border border-violet-200">
                      <p className="text-[10px] font-bold text-violet-700 leading-tight">Proceso de cobro</p>
                      <p className="text-[9px] text-violet-500 mt-0.5">Liberándose pronto</p>
                    </div>
                  ) : (
                    <div className={`w-full py-2 rounded-xl text-xs font-semibold text-center ${
                      table.status === 'Occupied' ? 'bg-red-50 text-red-400'
                      : table.status === 'Cleaning' ? 'bg-blue-50 text-blue-400'
                      : 'bg-amber-50 text-amber-500'
                    }`}>
                      {table.status === 'Occupied' ? 'En uso'
                       : table.status === 'Cleaning' ? 'En limpieza'
                       : 'Reservada'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      </>}

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden my-8">
            <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Reservar</p>
                <h2 className="text-xl font-bold text-white">Mesa #{selectedTable.tableNumber}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedTable.zoneName} · hasta {selectedTable.capacity} personas</p>
              </div>
              <button onClick={() => setShowReservationModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Nombre del Cliente *
                  </label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Teléfono *
                  </label>
                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fecha *</label>
                  <input type="date" value={reservationDate} onChange={(e) => setReservationDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Hora *</label>
                  <input type="time" value={reservationTime} onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-900" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Personas *
                  </label>
                  <input type="number" value={reservationGuests} onChange={(e) => setReservationGuests(e.target.value)}
                    max={selectedTable.capacity} placeholder={`Máximo ${selectedTable.capacity}`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-900" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Bloquear mesa (min antes)
                  </label>
                  <div className="flex gap-2">
                    {[30, 45, 60, 90, 120].map(min => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setAdvanceBlockMinutes(String(min))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${
                          advanceBlockMinutes === String(min)
                            ? 'bg-amber-400 text-white border-amber-400'
                            : 'bg-white text-slate-600 border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        {min} min
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">La mesa se mostrará como reservada este tiempo antes de la hora de la reserva</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notas especiales</label>
                  <textarea value={reservationNotes} onChange={(e) => setReservationNotes(e.target.value)} rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-slate-900 resize-none" />
                </div>
              </div>

              {/* Pre-order section */}
              <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPreOrder(!showPreOrder)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-700">
                    Pre-ordenar platos <span className="font-normal text-slate-400">(opcional)</span>
                  </span>
                  <span className={`text-xs transition-transform ${showPreOrder ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {showPreOrder && (
                  <div className="p-4 space-y-3">
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {menuDishes.filter((d: any) => d.isAvailable !== false).map((dish: any) => {
                        const inCart = preOrderItems.find(i => i.dishId === (dish.id ?? dish.Id));
                        const id = dish.id ?? dish.Id;
                        return (
                          <div key={id} className="flex items-center justify-between py-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800 truncate">{dish.name ?? dish.Name}</p>
                              <p className="text-xs text-amber-600">RD$ {Number(dish.price ?? dish.Price).toLocaleString('es-DO')}</p>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                              {inCart ? (
                                <>
                                  <button type="button" onClick={() => setPreOrderItems(prev => {
                                    const ex = prev.find(i => i.dishId === id);
                                    if (ex && ex.quantity > 1) return prev.map(i => i.dishId === id ? { ...i, quantity: i.quantity - 1 } : i);
                                    return prev.filter(i => i.dishId !== id);
                                  })} className="h-6 w-6 rounded-full bg-gray-200 text-xs font-bold">-</button>
                                  <span className="w-4 text-center text-sm font-bold">{inCart.quantity}</span>
                                  <button type="button" onClick={() => setPreOrderItems(prev => prev.map(i => i.dishId === id ? { ...i, quantity: i.quantity + 1 } : i))} className="h-6 w-6 rounded-full bg-amber-400 text-white text-xs font-bold">+</button>
                                </>
                              ) : (
                                <button type="button" onClick={() => setPreOrderItems(prev => [...prev, { dishId: id, name: dish.name ?? dish.Name, price: dish.price ?? dish.Price, quantity: 1 }])} className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 border border-amber-200">+</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {preOrderItems.length > 0 && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        {preOrderItems.map(i => (
                          <div key={i.dishId} className="flex justify-between text-xs text-slate-600">
                            <span>{i.quantity}x {i.name}</span>
                            <span className="text-amber-700 font-medium">RD$ {(i.price * i.quantity).toLocaleString('es-DO')}</span>
                          </div>
                        ))}
                        <div className="mt-1 pt-1 border-t border-amber-300 flex justify-between text-sm font-bold">
                          <span>Total</span>
                          <span className="text-amber-700">RD$ {preOrderItems.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString('es-DO')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-3">
                <button onClick={() => setShowReservationModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button onClick={createReservation} className="flex-1 px-4 py-3 bg-amber-400 text-white rounded-xl hover:bg-amber-500 text-sm font-semibold transition-colors shadow-sm">
                  Crear Reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
