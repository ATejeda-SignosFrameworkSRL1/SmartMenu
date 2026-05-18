'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Utensils, Clock, DollarSign, CheckCircle, AlertCircle, XCircle, LogOut, Wine, Check, RefreshCw, QrCode, Users, ArrowRightLeft, Share2, Pin, PinOff, Bell, X, ChefHat, Play, Square } from 'lucide-react';
// Icono de exclamación para alarma en mesas con pedido sin asignar
const AlertExclamation = () => (
  <span className="inline-flex items-center justify-center text-red-600 font-bold text-xl animate-pulse" style={{ animationDuration: '0.8s' }}>!</span>
);
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useWaiterNotifications, WaiterNotification } from '@/lib/useWaiterNotifications';

// Carga dinámica del QrScanner para evitar chunk errors en HTTPS
const QrScanner = dynamic(() => import('./components/QrScanner').then(mod => ({ default: mod.QrScanner })), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-600 animate-pulse">Cargando cámara...</p>
});

interface Order {
  id: number;
  orderNumber: string;
  tableId: number;
  tableNumber: number;
  status: string;
  total: number;
  createdAt: string;
  assignedWaiterId?: number;
  paymentCollectedByWaiter?: boolean;
  paymentTipAmount?: number;
  items: Array<{
    id: number;
    dishName: string;
    quantity: number;
    notes?: string;
  }>;
}

// Bartender: mismo login que waiter pero ve KDS de bebidas
const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  return DRINK_KEYWORDS.some(k => name.includes(k));
}
function getElapsedMinutes(createdAt: string | number | undefined): number {
  if (createdAt == null) return 0;
  const utcStr = typeof createdAt === 'string' && !createdAt.endsWith('Z') ? createdAt + 'Z' : createdAt;
  return Math.floor((Date.now() - new Date(utcStr as string).getTime()) / 60000);
}
// Bar KDS está separado: el personal de bar usa el panel de admin (/bar). En Waiter App nunca se muestra la vista Bar.
function isBartender(_u: any): boolean {
  return false;
}

// Usar siempre el id de la orden (PK), no tableNumber
function getOrderId(order: Order): number {
  return (order as any).id ?? (order as any).Id;
}

function getUserId(u: any): number {
  const id = u?.id ?? u?.Id ?? u?.ID;
  console.log('🔍 getUserId llamado:', { user: u, result: id });
  return id;
}

interface WaiterStats {
  totalSales: number;
  totalTips: number;
  totalAmount: number;
  transactionCount: number;
}

interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: string;
  zoneName: string;
}

export default function WaiterPage() {
  const [user, setUser] = useState<any>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [generalOrders, setGeneralOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<WaiterStats>({ totalSales: 0, totalTips: 0, totalAmount: 0, transactionCount: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'general' | 'my-tables'>('general');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  // Estados del modal de cobro expandido
  const [pmMethod, setPmMethod] = useState('Cash');
  const [pmTipPct, setPmTipPct] = useState(0);
  const [pmCustomTip, setPmCustomTip] = useState('');
  const [pmSplitType, setPmSplitType] = useState<'None' | 'ByComensal' | 'ByTime' | 'Proportional' | 'ByCategory'>('None');
  const [pmSplitParts, setPmSplitParts] = useState(2);
  const [pmByTimePart1, setPmByTimePart1] = useState('');
  const [pmByTimePart2, setPmByTimePart2] = useState('');
  const [pmByTimePayPart, setPmByTimePayPart] = useState<1 | 2>(1);
  const [pmPropAssign, setPmPropAssign] = useState<Record<number, number>>({});
  const [pmPayAsPerson, setPmPayAsPerson] = useState(1);
  const [pmPayCategory, setPmPayCategory] = useState('');
  const [pmMixedCash, setPmMixedCash] = useState('');
  const [pmMixedCard, setPmMixedCard] = useState('');
  const [pmMixedTransfer, setPmMixedTransfer] = useState('');
  const [pmProcessing, setPmProcessing] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderModalOrder, setOrderModalOrder] = useState<Order | null>(null);
  const [barOrdersRaw, setBarOrdersRaw] = useState<any[]>([]);
  const [identifiedTableId, setIdentifiedTableId] = useState<number | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrTableInput, setQrTableInput] = useState('');
  const [showQrCamera, setShowQrCamera] = useState(false);
  const [showVirtualTableCamera, setShowVirtualTableCamera] = useState(false);
  const [showVirtualTableModal, setShowVirtualTableModal] = useState(false);
  const [virtualTableIds, setVirtualTableIds] = useState<string>('');
  const [showMoveModal, setShowMoveModal] = useState<{ order: Order } | null>(null);
  const [moveTargetTableId, setMoveTargetTableId] = useState<number | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTableIds, setTransferTableIds] = useState<number[]>([]);
  const [transferToWaiterId, setTransferToWaiterId] = useState<number | null>(null);
  const [waiterList, setWaiterList] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [showManualOrderModal, setShowManualOrderModal] = useState(false);
  const [manualOrderTableId, setManualOrderTableId] = useState<number | null>(null);
  const [dishesForManual, setDishesForManual] = useState<any[]>([]);
  const [virtualTablesList, setVirtualTablesList] = useState<any[]>([]);
  const [showVirtualTableDetailsModal, setShowVirtualTableDetailsModal] = useState<any>(null);
  const [showMyOrderModal, setShowMyOrderModal] = useState(false);
  const [myOrderModalOrder, setMyOrderModalOrder] = useState<Order | null>(null);
  const [myOrderModalTab, setMyOrderModalTab] = useState<'kitchen' | 'bar'>('kitchen');
  const [abandonConfirmOrder, setAbandonConfirmOrder] = useState<Order | null>(null);
  const [claimConfirmOrder, setClaimConfirmOrder] = useState<Order | null>(null);
  // tableIds donde el mesero tiene sesión reclamada (pin activo); se pierde al soltar
  const [claimedTableIds, setClaimedTableIds] = useState<Set<number>>(new Set());
  // tableIds con solicitud de claim pendiente (esperando respuesta del admin)
  // Inicializar desde sessionStorage para sobrevivir refresh/navegación interna
  const [pendingClaimTableIds, setPendingClaimTableIds] = useState<Set<number>>(() => {
    try {
      const stored = sessionStorage.getItem('pendingClaimTableIds');
      if (stored) return new Set<number>(JSON.parse(stored));
    } catch { /* ignore */ }
    return new Set<number>();
  });
  // Shift state
  const [activeShift, setActiveShift] = useState<{ id: number; startTime: string; durationMinutes: number } | null>(null);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [endShiftTransferTo, setEndShiftTransferTo] = useState<number | null>(null);
  const [shiftStep, setShiftStep] = useState<1 | 2 | 3>(1); // 1=resumen, 2=transferencia, 3=resultado
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [shiftLoadingModal, setShiftLoadingModal] = useState(false);
  const [shiftResult, setShiftResult] = useState<any>(null);
  const [selectedVTTableIndex, setSelectedVTTableIndex] = useState(0);
  const [notifToken, setNotifToken] = useState<string | null>(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  
  // SignalR notifications
  const waiterId = user ? getUserId(user) : null;
  const { notifications, unreadCount, connected, markAllRead, dismiss, clearAll } = useWaiterNotifications({
    waiterId: waiterId ?? null,
    token: notifToken,
  });

  // Sincronizar pendingClaimTableIds con sessionStorage cuando cambia
  useEffect(() => {
    try {
      sessionStorage.setItem('pendingClaimTableIds', JSON.stringify([...pendingClaimTableIds]));
    } catch { /* ignore */ }
  }, [pendingClaimTableIds]);

  // ── Polling de respaldo: detecta claims aprobados/rechazados aunque SignalR falle ──
  const processedClaimIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const pollClaims = async () => {
      const uid = user ? getUserId(user) : null;
      if (!uid || pendingClaimTableIds.size === 0) return;
      try {
        const token = localStorage.getItem('waiter_token');
        if (!token) return;
        const res = await api.get(`/api/tableclaim/history?waiterId=${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list: any[] = Array.isArray(res.data) ? res.data : [];
        for (const r of list) {
          if (processedClaimIdsRef.current.has(r.id)) continue;
          if (r.status === 1 /* Approved */ && pendingClaimTableIds.has(r.tableId)) {
            processedClaimIdsRef.current.add(r.id);
            setClaimedTableIds(prev => new Set(prev).add(r.tableId));
            setPendingClaimTableIds(prev => { const s = new Set(prev); s.delete(r.tableId); return s; });
            toast(`✅ ¡Solicitud aprobada! La Mesa ${r.tableNumber} es tuya.`, {
              duration: 8000, style: { background: '#f0fdf4', color: '#166534', fontWeight: 700 }
            });
          } else if (r.status === 2 /* Rejected */ && pendingClaimTableIds.has(r.tableId)) {
            processedClaimIdsRef.current.add(r.id);
            setPendingClaimTableIds(prev => { const s = new Set(prev); s.delete(r.tableId); return s; });
            toast(`❌ El admin no aprobó tu solicitud para la Mesa ${r.tableNumber}.`, {
              duration: 10000, style: { background: '#fef2f2', color: '#991b1b', fontWeight: 700 }
            });
          }
        }
      } catch {
        // silencioso — es un respaldo
      }
    };

    if (pendingClaimTableIds.size > 0) {
      pollClaims();
      const iv = setInterval(pollClaims, 8000);
      return () => clearInterval(iv);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClaimTableIds.size, user]);

  // ── Respaldo de notificaciones por polling de estado ─────────────────────────
  // Si SignalR no conecta, este useEffect detecta transiciones de estado en las
  // órdenes y mesas cada vez que el polling de 5s actualiza los datos.
  const notifStateRef = useRef<{
    kitchenReady: Set<number>;  // orderIds ya notificados
    barReady:     Set<number>;
    billing:      Set<number>;  // tableIds ya notificados
    initialized:  boolean;
  }>({ kitchenReady: new Set(), barReady: new Set(), billing: new Set(), initialized: false });

  useEffect(() => {
    const allOrders = [...myOrders, ...generalOrders];

    if (!notifStateRef.current.initialized) {
      // Primera carga: registrar estado actual como línea base (no notificar)
      notifStateRef.current.initialized = true;
      for (const o of allOrders) {
        const oid: number = (o as any).id;
        if ((o as any).kitchenReady || (o as any).KitchenReady) notifStateRef.current.kitchenReady.add(oid);
        if ((o as any).barReady    || (o as any).BarReady)    notifStateRef.current.barReady.add(oid);
      }
      for (const t of tables) {
        if (t.status === 'Billing') notifStateRef.current.billing.add(t.id);
      }
      return;
    }

    // Detección de cocina/bar listos
    for (const o of allOrders) {
      const oid: number = (o as any).id;
      const tn: number  = (o as any).tableNumber ?? (o as any).TableNumber ?? 0;
      const on: string  = ((o as any).orderNumber ?? '').split('-').pop() ?? '';
      const kr = !!((o as any).kitchenReady || (o as any).KitchenReady);
      const br = !!((o as any).barReady     || (o as any).BarReady);
      const ks = !!((o as any).kitchenServed|| (o as any).KitchenServed);
      const bs = !!((o as any).barServed    || (o as any).BarServed);

      if (kr && !ks && !notifStateRef.current.kitchenReady.has(oid)) {
        notifStateRef.current.kitchenReady.add(oid);
        toast(`🍽️ Cocina lista — Mesa ${tn} · Orden #${on}`, {
          duration: 10000, style: { background: '#fef3c7', color: '#92400e', fontWeight: 700 }
        });
      }
      if (br && !bs && !notifStateRef.current.barReady.has(oid)) {
        notifStateRef.current.barReady.add(oid);
        toast(`🍹 Bar listo — Mesa ${tn} · Orden #${on}`, {
          duration: 10000, style: { background: '#f3e8ff', color: '#6b21a8', fontWeight: 700 }
        });
      }
      // Limpiar cuando ya fue servido para que futuras órdenes puedan notificar
      if (ks) notifStateRef.current.kitchenReady.delete(oid);
      if (bs) notifStateRef.current.barReady.delete(oid);
    }

    // Rastrear estado de billing por polling (solo para limpieza del Set,
    // el toast/notificación lo envía SignalR para evitar duplicados).
    for (const t of tables) {
      if (t.status !== 'Billing') {
        notifStateRef.current.billing.delete(t.id);
      } else {
        notifStateRef.current.billing.add(t.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOrders, generalOrders, tables]);

  // Mostrar toast cuando llega una notificación nueva (vía SignalR)
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && notifications.length > 0) {
      const latest = notifications[0];
      if (latest.type === 'customer_finished') {
        toast(`✅ ${latest.message}`, { duration: 6000, style: { background: '#f0fdf4', color: '#166534', fontWeight: 600 } });
      } else if (latest.type === 'items_added') {
        toast(`➕ ${latest.message}`, { duration: 6000, style: { background: '#faf5ff', color: '#7e22ce', fontWeight: 600 } });
      } else if (latest.type === 'billing_requested') {
        toast(`💳 ${latest.message}`, { duration: 8000, style: { background: '#fefce8', color: '#854d0e', fontWeight: 600 } });
      } else if (latest.type === 'claim_approved') {
        // El admin aprobó: marcar la mesa como reclamada y quitar de pendientes
        // Usamos latest.tableId (ID de DB) que es lo que almacena pendingClaimTableIds/claimedTableIds
        const tId = latest.tableId ?? Number(latest.tableNumber);
        if (tId) {
          setClaimedTableIds(prev => new Set(prev).add(tId));
          setPendingClaimTableIds(prev => { const s = new Set(prev); s.delete(tId); return s; });
        }
        toast(`✅ ${latest.message}`, { duration: 8000, style: { background: '#f0fdf4', color: '#166534', fontWeight: 700 } });
      } else if (latest.type === 'claim_rejected') {
        // El admin rechazó: quitar de pendientes
        const tId = latest.tableId ?? Number(latest.tableNumber);
        if (tId) {
          setPendingClaimTableIds(prev => { const s = new Set(prev); s.delete(tId); return s; });
        }
        const note = latest.adminNote ? ` — "${latest.adminNote}"` : '';
        toast(`❌ ${latest.message}${note}`, { duration: 10000, style: { background: '#fef2f2', color: '#991b1b', fontWeight: 700 } });
      } else {
        toast(`🔔 ${latest.message}`, { duration: 6000, style: { background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 } });
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, notifications]);

  // Log cuando virtualTablesList cambie
  useEffect(() => {
    console.log('🎨 useEffect - virtualTablesList cambió:', virtualTablesList.length, 'elementos');
    if (virtualTablesList.length > 0) {
      console.log('🎨 useEffect - Primera mesa virtual:', virtualTablesList[0]?.name ?? virtualTablesList[0]?.Name);
    }
  }, [virtualTablesList]);
  
  // Ref para el intervalo de polling (no causa re-renders)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldPollRef = useRef(true);

  // Callbacks memoizados para QrScanner (evita re-crear funciones y desmontar el componente)
  const handleQrScanIdentify = useCallback(async (tableIdOrQrCode: number | string) => {
    console.log('🔵 handleQrScanIdentify llamado con:', tableIdOrQrCode, 'Tipo:', typeof tableIdOrQrCode);
    // Si es número, buscar por número de mesa o ID
    if (typeof tableIdOrQrCode === 'number') {
      console.log('🔵 Es número, buscando en tables:', tables.length, 'mesas');
      const t = tables.find(tb => tb.tableNumber === tableIdOrQrCode || tb.id === tableIdOrQrCode);
      if (t) {
        console.log('✅ Mesa encontrada:', t);
        setIdentifiedTableId(t.id);
        toast.success(`Mesa ${t.tableNumber} identificada`);
      } else {
        console.log('⚠️ Mesa no encontrada en lista, usando ID directo');
        setIdentifiedTableId(tableIdOrQrCode);
        toast.success('Mesa identificada por ID');
      }
    } else {
      console.log('🔵 Es string (GUID), buscando en API:', tableIdOrQrCode);
      // Es un GUID, buscar mesa por qrCode
      try {
        const token = localStorage.getItem('waiter_token');
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        console.log('🔵 Llamando GET /api/table/qr/' + tableIdOrQrCode);
        const response = await api.get(`/api/table/qr/${tableIdOrQrCode}`);
        console.log('✅ Respuesta de API:', response.data);
        const table = response.data;
        if (table && table.id) {
          setIdentifiedTableId(table.id);
          toast.success(`Mesa ${table.tableNumber} identificada`);
        } else {
          console.error('❌ Respuesta sin datos válidos:', table);
          toast.error('Mesa no encontrada');
        }
      } catch (error) {
        console.error('❌ Error al buscar mesa por QR:', error);
        toast.error('Error al identificar mesa');
      }
    }
    setShowQrModal(false);
    setShowQrCamera(false);
    setQrTableInput('');
  }, [tables]);

  const handleQrScanVirtual = useCallback(async (tableIdOrQrCode: number | string) => {
    console.log('🟣 handleQrScanVirtual llamado con:', tableIdOrQrCode, 'Tipo:', typeof tableIdOrQrCode);
    let tableNumber: number;
    
    // Si es número, usar directamente
    if (typeof tableIdOrQrCode === 'number') {
      tableNumber = tableIdOrQrCode;
      console.log('🟣 Es número, usando directamente:', tableNumber);
    } else {
      console.log('🟣 Es string (GUID), buscando en API:', tableIdOrQrCode);
      // Es un GUID, buscar mesa por qrCode
      try {
        const token = localStorage.getItem('waiter_token');
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        console.log('🟣 Llamando GET /api/table/qr/' + tableIdOrQrCode);
        const response = await api.get(`/api/table/qr/${tableIdOrQrCode}`);
        console.log('✅ Respuesta de API:', response.data);
        const table = response.data;
        if (table && table.tableNumber) {
          tableNumber = table.tableNumber;
          console.log('✅ Mesa encontrada, tableNumber:', tableNumber);
        } else {
          console.error('❌ Respuesta sin tableNumber:', table);
          toast.error('Mesa no encontrada');
          return;
        }
      } catch (error) {
        console.error('❌ Error al buscar mesa por QR:', error);
        toast.error('Error al identificar mesa');
        return;
      }
    }
    
    setVirtualTableIds(prev => {
      const parts = prev.split(/[\s,]+/).filter(Boolean);
      if (parts.includes(String(tableNumber))) return prev;
      return [...parts, String(tableNumber)].join(', ');
    });
    toast.success(`Mesa ${tableNumber} añadida`);
    console.log('✅ Mesa añadida a virtual table IDs:', tableNumber);
  }, []);

  const handleQrError = useCallback((msg: string) => {
    toast.error(msg);
  }, []);

  const handleQrClose = useCallback(() => {
    setShowQrCamera(false);
  }, []);

  const handleVirtualQrClose = useCallback(() => {
    setShowVirtualTableCamera(false);
  }, []);

  const deleteVirtualTable = async (vtId: number) => {
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      console.log('🗑️ Eliminando mesa virtual ID:', vtId);
      await api.put(`/api/virtualtable/${vtId}/deactivate`);
      toast.success('Mesa virtual deshecha');
      
      // Recargar datos
      await loadVirtualTables();
      await loadData(getUserId(user));
    } catch (e: any) {
      console.error('❌ Error al deshacer mesa virtual:', e);
      toast.error(e?.response?.data?.error || 'Error al deshacer mesa virtual');
    }
  };

  const loadBarOrders = async () => {
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/order/active');
      const data = Array.isArray(res.data) ? res.data : [];
      const getCreatedAt = (o: any) => o?.createdAt ?? o?.CreatedAt ?? 0;
      setBarOrdersRaw(data.sort((a: any, b: any) =>
        new Date(getCreatedAt(a)).getTime() - new Date(getCreatedAt(b)).getTime()
      ));
    } catch {
      setBarOrdersRaw([]);
    }
  };

  const setBarPreparing = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/bar-preparing`);
      toast.success('Marcado como Preparando');
      loadBarOrders();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const setBarReady = async (orderId: number) => {
    try {
      await api.put(`/api/order/${orderId}/bar-ready`);
      toast.success('Bebidas marcadas como listas');
      loadBarOrders();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  // Efecto para pausar/reanudar polling cuando se abre/cierra la cámara
  useEffect(() => {
    shouldPollRef.current = !showQrCamera && !showVirtualTableCamera;
  }, [showQrCamera, showVirtualTableCamera]);

  // Bloquear scroll del body cuando hay modales abiertos
  useEffect(() => {
    const hasModal = showPaymentModal || showOrderModal || showQrModal || showVirtualTableModal || showMoveModal || showTransferModal || showManualOrderModal || showMyOrderModal;
    if (hasModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPaymentModal, showOrderModal, showQrModal, showVirtualTableModal, showMoveModal, showTransferModal, showManualOrderModal, showMyOrderModal]);

  // Bloquear scroll del body cuando hay modales abiertos
  useEffect(() => {
    const isModalOpen = showQrModal || showVirtualTableModal || showPaymentModal || showOrderModal || showMoveModal || showTransferModal || showManualOrderModal;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showQrModal, showVirtualTableModal, showPaymentModal, showOrderModal, showMoveModal, showTransferModal, showManualOrderModal]);

  useEffect(() => {
    const initAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      const userFromUrl = urlParams.get('user');

      if (tokenFromUrl && userFromUrl) {
        localStorage.setItem('waiter_token', tokenFromUrl);
        localStorage.setItem('waiter_user', decodeURIComponent(userFromUrl));
        window.history.replaceState({}, '', '/');
      }

      const token = localStorage.getItem('waiter_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setNotifToken(token);

      let resolvedUser: any;
      try {
        console.log('🔐 Llamando a /api/auth/me...');
        const { data: currentUser } = await api.get('/api/auth/me');
        console.log('🔐 Respuesta de /api/auth/me:', currentUser);
        console.log('🔐 currentUser.id:', currentUser?.id);
        console.log('🔐 currentUser.Id:', currentUser?.Id);
        
        if (currentUser && (currentUser.id != null || currentUser.Id != null)) {
          resolvedUser = currentUser;
          setUser(currentUser);
          localStorage.setItem('waiter_user', JSON.stringify(currentUser));
          console.log('✅ Usuario guardado en state y localStorage');
        } else {
          console.log('⚠️ currentUser no tiene id, cargando desde localStorage');
          const userData = localStorage.getItem('waiter_user');
          if (!userData) {
            window.location.href = '/login';
            return;
          }
          resolvedUser = JSON.parse(userData);
          setUser(resolvedUser);
          console.log('✅ Usuario cargado desde localStorage:', resolvedUser);
        }
      } catch (error) {
        console.error('❌ Error llamando /api/auth/me:', error);
        const userData = localStorage.getItem('waiter_user');
        if (!userData) {
          window.location.href = '/login';
          return;
        }
        resolvedUser = JSON.parse(userData);
        setUser(resolvedUser);
        console.log('✅ Usuario cargado desde localStorage (catch):', resolvedUser);
      }

      const waiterId = getUserId(resolvedUser);
      if (!waiterId) {
        setLoading(false);
        return;
      }
      await Promise.all([loadData(waiterId), loadVirtualTables()]);
      // Load shift status
      try {
        const shiftRes = await api.get(`/api/waitershift/active/${waiterId}`);
        if (shiftRes.data?.hasActiveShift) {
          setActiveShift({ id: shiftRes.data.id, startTime: shiftRes.data.startTime, durationMinutes: shiftRes.data.durationMinutes });
        }
      } catch { /* ignore */ }

      // ── Restaurar solicitudes de claim pendientes desde la base de datos ──────
      // Esto garantiza que al refrescar o cambiar de tab, el estado "Solicitud pendiente"
      // se muestre correctamente aunque React haya perdido el estado en memoria.
      try {
        const claimRes = await api.get(`/api/tableclaim/history?waiterId=${waiterId}`);
        const claimList: any[] = Array.isArray(claimRes.data) ? claimRes.data : [];

        // Pre-marcar todos los claims YA resueltos (no-pendientes) como procesados.
        // Esto evita que el polling de respaldo los tome como "nuevos" al arrancar.
        claimList
          .filter(r => r.status !== 0 /* cualquiera que no sea Pending */)
          .forEach(r => processedClaimIdsRef.current.add(r.id));

        // Restaurar solo los realmente pendientes al state.
        // El backend es la fuente de verdad — reemplaza lo que había en sessionStorage.
        const stillPending = claimList
          .filter(r => r.status === 0 /* Pending */)
          .map(r => r.tableId as number);
        // Siempre sincronizar (incluyendo vacío) para limpiar datos obsoletos del sessionStorage
        setPendingClaimTableIds(new Set(stillPending));
      } catch { /* ignore — no crítico */ }

      setLoading(false);
      pollingIntervalRef.current = setInterval(() => {
        if (!shouldPollRef.current) {
          console.log('⏸️ Polling pausado (cámara activa)');
          return; // Pausar si la cámara está abierta
        }
        const u = JSON.parse(localStorage.getItem('waiter_user') || '{}');
        const id = getUserId(u);
        if (id) {
          console.log('🔄 Polling - Recargando datos... (uid:', id, ')');
          loadData(id);
            loadVirtualTables();
          } else {
            console.log('⚠️ Polling - No se pudo obtener user ID del localStorage');
          }
        }, 5000);
    };

    initAuth();
    return () => {
      if (pollingIntervalRef.current != null) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (waiterId: number) => {
    const token = localStorage.getItem('waiter_token');
    if (!token) return;
    if (waiterId == null || waiterId === 0 || Number.isNaN(Number(waiterId))) {
      return;
    }

    try {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const [tablesRes, unassignedRes, myOrdersRes, statsRes] = await Promise.all([
        api.get('/api/table'),
        api.get('/api/order/unassigned'),
        api.get(`/api/order/my-orders/${waiterId}`),
        api.get(`/api/payment/waiter-stats/${waiterId}`)
      ]);

      const unassigned = Array.isArray(unassignedRes.data) ? unassignedRes.data : (unassignedRes.data?.data ?? []);
      const myOrdersList = Array.isArray(myOrdersRes.data) ? myOrdersRes.data : (myOrdersRes.data?.data ?? []);

      console.log('📊 loadData - Unassigned orders:', unassigned.length);
      console.log('📊 loadData - My orders:', myOrdersList.length);
      console.log('📊 loadData - Tables in unassigned:', [...new Set(unassigned.map((o: any) => o.tableId || o.TableId))]);

      setTables(Array.isArray(tablesRes.data) ? tablesRes.data : tablesRes.data?.data ?? []);
      setGeneralOrders(unassigned);
      setMyOrders(myOrdersList);
      setStats(statsRes?.data ?? { totalSales: 0, totalTips: 0, totalAmount: 0, transactionCount: 0 });
    } catch (error: any) {
      console.error('Error loading data:', error);
    }
  };

  const loadWaiters = async () => {
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/user');
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      const waiters = list
        .filter((u: any) => (u.role ?? u.Role) === 'Waiter' && (u.id ?? u.Id) !== getUserId(user))
        .map((u: any) => ({ id: u.id ?? u.Id, firstName: u.firstName ?? u.FirstName ?? '', lastName: u.lastName ?? u.LastName ?? '' }));
      setWaiterList(waiters);
    } catch {
      setWaiterList([]);
    }
  };

  const loadPendingTransfers = async () => {
    const uid = getUserId(user);
    if (!uid) return;
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get(`/api/tabletransfer/pending-for/${uid}`);
      setPendingTransfers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPendingTransfers([]);
    }
  };

  const loadVirtualTables = async () => {
    // Intentar obtener user del estado, si no del localStorage
    let currentUser = user;
    if (!currentUser || (!currentUser.id && !currentUser.Id)) {
      const userData = localStorage.getItem('waiter_user');
      if (userData) {
        currentUser = JSON.parse(userData);

      }
    }
    
    const uid = getUserId(currentUser);

    if (!uid) {
      console.log('❌ loadVirtualTables - No uid, retornando');
      return;
    }
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) {
        console.log('❌ loadVirtualTables - No token, retornando');
        return;
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get(`/api/virtualtable/waiter/${uid}`);
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0) {
        console.log('✅ loadVirtualTables - primer elemento:', JSON.stringify(list[0], null, 2));
      }

      setVirtualTablesList([...list]); // Crear nueva referencia para forzar re-render

    } catch (error: any) {
      setVirtualTablesList([]);
    }
  };

  const identifyTableByQr = () => {
    const raw = qrTableInput.trim().replace(/^table-/i, '');
    const num = parseInt(raw, 10);
    if (!Number.isNaN(num) && num > 0) {
      const t = tables.find(tb => tb.tableNumber === num || tb.id === num);
      if (t) {
        setIdentifiedTableId(t.id);
        setShowQrModal(false);
        setQrTableInput('');
        toast.success(`Mesa ${t.tableNumber} identificada`);
      } else {
        setIdentifiedTableId(num);
        setShowQrModal(false);
        setQrTableInput('');
        toast.success('Mesa identificada por ID');
      }
    } else {
      toast.error('Ingresa un número de mesa válido (ej. 5 o table-5)');
    }
  };

  const createVirtualTable = async () => {
    const ids = virtualTableIds.split(/[\s,]+/).map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n) && n > 0);

    if (ids.length === 0) {
      toast.error('Debes escanear al menos 2 mesas', { duration: 4000 });
      return;
    }
    
    if (ids.length < 2) {
      toast.error('Las mesas virtuales requieren mínimo 2 mesas', { duration: 4000 });
      return;
    }
    
    // VALIDACIÓN PREVIA: Verificar si alguna mesa ya está en una mesa virtual
    const tableObjects = ids
      .map(id => tables.find(tb => tb.tableNumber === id || tb.id === id))
      .filter((t): t is Table => t != null);
    
    if (tableObjects.length !== ids.length) {
      const missingIds = ids.filter(id => !tableObjects.some(tb => tb?.tableNumber === id || tb?.id === id));
      toast.error(`Mesas no encontradas: ${missingIds.join(', ')}`, { duration: 4000 });
      return;
    }
    
    // Verificar si alguna mesa ya está en una mesa virtual activa
    const tableIdsSet = new Set(tableObjects.map(t => t!.id));
    const alreadyInVirtual = virtualTablesList.flatMap(vt => 
      (vt.tables || vt.Tables || []).map((t: any) => ({ 
        tableId: t.id || t.Id, 
        tableNumber: t.tableNumber || t.TableNumber,
        vtName: vt.name || vt.Name 
      }))
    ).filter(t => tableIdsSet.has(t.tableId));
    
    if (alreadyInVirtual.length > 0) {
      const tableNumbers = alreadyInVirtual.map(t => `#${t.tableNumber}`).join(', ');
      const vtNames = [...new Set(alreadyInVirtual.map(t => t.vtName))].join(', ');
      toast.error(
        `⚠️ No se puede crear: Las mesas ${tableNumbers} ya pertenecen a la mesa virtual "${vtNames}".\n\nPrimero debes deshacer esa mesa virtual.`, 
        { duration: 6000 }
      );
      return;
    }
    
    // Verificar si alguna mesa está ocupada
    const occupiedTables = tableObjects.filter(t => t!.status === 'Occupied' || (t as any).Status === 1);
    if (occupiedTables.length > 0) {
      const occupiedNumbers = occupiedTables.map(t => `#${t!.tableNumber}`).join(', ');
      toast.error(
        `⚠️ No se puede crear: Las mesas ${occupiedNumbers} ya están ocupadas.\n\nLas mesas deben estar disponibles para crear una mesa virtual.`,
        { duration: 6000 }
      );
      return;
    }
    
    // tableObjects ya está definido arriba
    const tableIdList = tableObjects.map(t => t!.id);
    
    if (tableIdList.length < 2) {
      toast.error('Debes seleccionar al menos 2 mesas válidas');
      return;
    }
    
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) {
        toast.error('No hay token de autenticación');
        console.error('❌ No hay token');
        return;
      }  
      const uid = getUserId(user);
      if (!uid || uid === 0 || Number.isNaN(uid)) {
        toast.error('Usuario no válido - ID: ' + uid);
        console.error('❌ No hay user ID válido:', uid);
        return;
      }
      
      // Crear nombre descriptivo: V(Zona) #1, #2, #3
      const zones = [...new Set(tableObjects.map(t => t.zoneName || 'Sin Zona'))].filter(Boolean);
      const tableNumbers = tableObjects.map(t => `#${t.tableNumber}`).join(', ');
      const virtualTableName = zones.length > 0 
        ? `V${zones.join('/')} ${tableNumbers}` 
        : `V ${tableNumbers}`;
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const payload = {
        name: virtualTableName,
        createdByWaiterId: uid,
        tableIds: tableIdList
      };
      
      const response = await api.post('/api/virtualtable', payload);
      
      toast.success(`Mesa virtual creada: ${virtualTableName}`);
      
      // Cerrar modal y limpiar
      setShowVirtualTableModal(false);
      setVirtualTableIds('');
      setShowVirtualTableCamera(false);
      
      // Delay para asegurar que el backend terminó de guardar
      console.log('⏳ Esperando 2 segundos antes de recargar...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('⏳ Espera completada, recargando ahora...');
      
      // Forzar re-fetch con timestamp para evitar cache
      console.log('🔄 Recargando datos con force refresh...');
      const timestamp = Date.now();
      api.defaults.headers.common['X-Refresh'] = timestamp.toString();
      
      // Recargar en orden específico
      console.log('🔄 1. Recargando datos generales...');
      await loadData(uid);
      console.log('✅ Datos generales recargados');
      
      console.log('🔄 2. Recargando mesas virtuales...');
      await loadVirtualTables();
      console.log('✅ Virtual tables cargadas');
      
      // Esperar un tick para que React procese los cambios de estado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Cambiar a vista "Mis Mesas" DESPUÉS de cargar todo
      console.log('🔄 3. Cambiando a vista my-tables...');
      setView('my-tables');
      console.log('✅ Vista cambiada, todo completado');
      
    } catch (e: any) {
      console.error('❌ Error completo al crear mesa virtual:', e);
      console.error('❌ Error response:', e?.response);
      console.error('❌ Error response data:', e?.response?.data);
      const errorMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Error al crear mesa virtual';
      
      // Mostrar error de manera más visible
      if (errorMsg.includes('ya están en otra mesa virtual') || errorMsg.includes('ya están ocupadas')) {
        toast.error(`⚠️ ${errorMsg}`, { duration: 6000 });
      } else {
        toast.error(`Error: ${errorMsg}`, { duration: 5000 });
      }
    }
  };

  const moveOrderToTable = async () => {
    if (!showMoveModal || !moveTargetTableId) return;
    const orderId = getOrderId(showMoveModal.order);
    try {
      await api.put(`/api/order/${orderId}/move-to-table/${moveTargetTableId}`);
      toast.success('Comensal movido a la nueva mesa');
      setShowMoveModal(null);
      setMoveTargetTableId(null);
      loadData(getUserId(user!));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al mover');
    }
  };

  const sendTransfer = async () => {
    if (transferTableIds.length === 0 || !transferToWaiterId) {
      toast.error('Selecciona mesas y mesero destino');
      return;
    }
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await api.post('/api/tabletransfer', {
        fromWaiterId: getUserId(user),
        toWaiterId: transferToWaiterId,
        tableIds: transferTableIds
      });
      toast.success('Solicitud de transferencia enviada');
      setShowTransferModal(false);
      setTransferTableIds([]);
      setTransferToWaiterId(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al enviar');
    }
  };

  const acceptTransfer = async (requestId: number) => {
    try {
      await api.put(`/api/tabletransfer/${requestId}/accept?waiterId=${getUserId(user)}`);
      toast.success('Transferencia aceptada');
      loadPendingTransfers();
      loadData(getUserId(user!));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error');
    }
  };

  const rejectTransfer = async (requestId: number) => {
    try {
      await api.put(`/api/tabletransfer/${requestId}/reject?waiterId=${getUserId(user)}`);
      toast.success('Transferencia rechazada');
      loadPendingTransfers();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error');
    }
  };

  const openManualOrder = (tableId: number) => {
    setManualOrderTableId(tableId);
    setShowManualOrderModal(true);
    api.get('/api/dish', { params: { all: true } }).then(r => setDishesForManual(Array.isArray(r.data) ? r.data : [])).catch(() => setDishesForManual([]));
  };

  const confirmOrder = async (order: Order): Promise<boolean> => {
    if (!user) return false;
    const orderId = getOrderId(order);
    const waiterId = getUserId(user);
    try {
      // assign-waiter ya pone la orden en Confirmed y la asigna al mesero; evita doble request que podía dejar la mesa en General
      await api.put(`/api/order/${orderId}/assign-waiter/${waiterId}`);
      toast.success('Orden confirmada y asignada a ti');
      await loadData(waiterId);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Error al confirmar orden';
      toast.error(msg);
      return false;
    }
  };

  const markAsServed = async (orderId: number) => {
    if (!user) return;
    try {
      await api.put(`/api/order/${orderId}/status`, { newStatus: 'Served' });
      toast.success('Orden marcada como servida');
      loadData(getUserId(user));
      loadVirtualTables();
    } catch (error) {
      toast.error('Error al marcar como servida');
    }
  };

  /** Marcar todas las órdenes Ready de la mesa como servidas (por mesa completa). */
  const markTableAsServed = async (orders: Order[]) => {
    const readyOrders = orders.filter(o => (o as any).status === 'Ready' || (o as any).Status === 'Ready');
    if (readyOrders.length === 0) {
      toast('No hay órdenes listas para marcar como servidas');
      return;
    }
    if (!user) return;
    try {
      for (const order of readyOrders) {
        await api.put(`/api/order/${getOrderId(order)}/status`, { newStatus: 'Served' });
      }
      toast.success(`${readyOrders.length} orden(es) marcada(s) como servida(s)`);
      loadData(getUserId(user));
      loadVirtualTables();
    } catch (error) {
      toast.error('Error al marcar como servidas');
    }
  };

  const openPaymentModal = (order: Order) => {
    setSelectedOrder(order);
    // Pre-cargar preferencias del cliente
    const o = order as any;
    const clientMethod = o.clientRequestedPaymentMethod ?? o.ClientRequestedPaymentMethod ?? 'Cash';
    const orderTotalForModal = Number(o.total ?? o.totalAmount ?? 0);
    setPmMethod(clientMethod);
    setPmTipPct(Number(o.clientTipPercentage ?? o.ClientTipPercentage ?? 0));
    setPmCustomTip(
      Number(o.clientTipPercentage ?? 0) === 0 && Number(o.clientTipAmount ?? 0) > 0
        ? String(o.clientTipAmount ?? o.ClientTipAmount ?? '')
        : ''
    );
    setPmSplitType('None');
    setPmSplitParts(2);
    setPmByTimePart1('');
    setPmByTimePart2('');
    setPmByTimePayPart(1);
    setPmPropAssign({});
    setPmPayAsPerson(1);
    setPmPayCategory('');
    // Si el cliente pidió Mixto, pre-rellenar el monto completo en efectivo como punto de partida
    if (clientMethod === 'Mixed') {
      setPmMixedCash(orderTotalForModal > 0 ? orderTotalForModal.toFixed(2) : '');
      setPmMixedCard('');
      setPmMixedTransfer('');
    } else {
      setPmMixedCash('');
      setPmMixedCard('');
      setPmMixedTransfer('');
    }
    setShowPaymentModal(true);
  };

  const collectPayment = async (order: Order) => {
    if (!user) return;
    setPmProcessing(true);
    try {
      const orderId = getOrderId(order);
      const waiterId = getUserId(user);
      const orderTotal = Number((order as any).total ?? (order as any).totalAmount ?? 0);
      const orderItems: any[] = (order as any).items ?? [];

      // Calcular propina del mesero
      const tipAmt = pmTipPct > 0
        ? orderTotal * (pmTipPct / 100)
        : (pmCustomTip ? parseFloat(pmCustomTip) || 0 : 0);
      const tipPct = pmTipPct > 0
        ? pmTipPct
        : (pmCustomTip && orderTotal > 0 ? (parseFloat(pmCustomTip) / orderTotal) * 100 : 0);

      // Calcular la porción a cobrar según split
      const taxRate = orderTotal > 0 ? (Number((order as any).tax ?? 0) / (Number((order as any).subtotal ?? 1) || 1)) : 0.18;
      let myPortion = orderTotal;
      if (pmSplitType === 'ByComensal' && pmSplitParts > 0) {
        myPortion = orderTotal / pmSplitParts;
      } else if (pmSplitType === 'ByTime') {
        myPortion = pmByTimePayPart === 1 ? (parseFloat(pmByTimePart1) || 0) : (parseFloat(pmByTimePart2) || 0);
        if (myPortion <= 0) myPortion = orderTotal;
      } else if (pmSplitType === 'Proportional' && pmSplitParts > 0) {
        const perPerson: Record<number, number> = {};
        for (let i = 1; i <= pmSplitParts; i++) perPerson[i] = 0;
        orderItems.forEach((item: any) => {
          const sub = Number(item.subtotal ?? item.Subtotal ?? 0);
          const p = pmPropAssign[item.id ?? item.Id] ?? 1;
          perPerson[p] = (perPerson[p] ?? 0) + sub;
        });
        const subtotalP = perPerson[pmPayAsPerson] ?? 0;
        myPortion = subtotalP + subtotalP * taxRate;
      } else if (pmSplitType === 'ByCategory' && pmPayCategory) {
        const catTotals: Record<string, number> = {};
        orderItems.forEach((item: any) => {
          const cat = item.categoryName ?? item.CategoryName ?? 'Otros';
          const sub = Number(item.subtotal ?? item.Subtotal ?? 0);
          catTotals[cat] = (catTotals[cat] ?? 0) + sub;
        });
        Object.keys(catTotals).forEach(c => { catTotals[c] = catTotals[c] + catTotals[c] * taxRate; });
        myPortion = catTotals[pmPayCategory] ?? 0;
      }

      let body: any;

      if (pmMethod === 'Mixed') {
        const cashAmt     = parseFloat(pmMixedCash)     || 0;
        const cardAmt     = parseFloat(pmMixedCard)     || 0;
        const transferAmt = parseFloat(pmMixedTransfer) || 0;
        const totalMixed  = cashAmt + cardAmt + transferAmt;
        const subPayments = [];
        if (cashAmt > 0)     subPayments.push({ method: 'Cash',     amount: cashAmt,     tipAmount: totalMixed > 0 ? tipAmt * (cashAmt / totalMixed)     : 0 });
        if (cardAmt > 0)     subPayments.push({ method: 'Card',     amount: cardAmt,     tipAmount: totalMixed > 0 ? tipAmt * (cardAmt / totalMixed)     : 0 });
        if (transferAmt > 0) subPayments.push({ method: 'Transfer', amount: transferAmt, tipAmount: totalMixed > 0 ? tipAmt * (transferAmt / totalMixed) : 0 });

        body = {
          orderId, waiterId,
          paymentMethod: 'Mixed',
          billSplitType: pmSplitType !== 'None' ? pmSplitType : undefined,
          subPayments,
        };
      } else {
        body = {
          orderId, waiterId,
          paymentMethod: pmMethod,
          amount: myPortion,
          tipAmount: tipAmt,
          tipPercentage: tipPct,
          billSplitType: pmSplitType !== 'None' ? pmSplitType : undefined,
          splitPartIndex: pmSplitType === 'ByComensal' ? pmSplitParts
            : pmSplitType === 'ByTime' ? pmByTimePayPart
            : undefined,
        };
      }

      await api.post('/api/payment/collect', body);
      toast.success('Cobro registrado. Mesa en limpieza.');
      setShowPaymentModal(false);
      setSelectedOrder(null);
      loadData(getUserId(user));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Error al registrar cobro';
      toast.error(msg);
    } finally {
      setPmProcessing(false);
    }
  };

  const releaseTable = async (tableId: number) => {
    if (!user) return;
    try {
      await api.put(`/api/table/${tableId}/status`, { newStatus: 'Available' });
      toast.success('Mesa liberada');
      // Actualización optimista: marcar la mesa como Available en la UI de inmediato
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'Available' } : t));
      await loadData(getUserId(user));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Error al liberar mesa';
      toast.error(msg);
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Confirmed': return 'bg-blue-100 text-blue-800';
      case 'Preparing': return 'bg-purple-100 text-purple-800';
      case 'Ready': return 'bg-green-100 text-green-800';
      case 'Served': return 'bg-teal-100 text-teal-800';
      case 'Completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTableStatus = (order: Order): string => {
    const tid = (order as any).tableId ?? (order as any).TableId;
    const t = tables.find(tb => tb.id === tid || tb.id === Number(tid));
    return t?.status ?? '';
  };

  const loadShift = async () => {
    const uid = getUserId(user);
    if (!uid) return;
    try {
      const res = await api.get(`/api/waitershift/active/${uid}`);
      if (res.data?.hasActiveShift) {
        setActiveShift({ id: res.data.id, startTime: res.data.startTime, durationMinutes: res.data.durationMinutes });
      } else {
        setActiveShift(null);
      }
    } catch { /* ignore */ }
  };

  const startShift = async () => {
    const uid = getUserId(user);
    if (!uid) return;
    try {
      const res = await api.post('/api/waitershift/start', { waiterId: uid });
      setActiveShift({ id: res.data.id, startTime: res.data.startTime, durationMinutes: 0 });
      toast.success('Turno iniciado');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al iniciar turno');
    }
  };

  const openEndShiftModal = async () => {
    const uid = getUserId(user);
    if (!uid) return;
    setShiftStep(1);
    setShiftSummary(null);
    setShiftResult(null);
    setEndShiftTransferTo(null);
    setShowEndShiftModal(true);
    setShiftLoadingModal(true);
    try {
      loadWaiters();
      const res = await api.get(`/api/waitershift/summary/${uid}`);
      setShiftSummary(res.data);
    } catch {
      toast.error('Error al cargar el resumen del turno');
    } finally {
      setShiftLoadingModal(false);
    }
  };

  const endShift = async () => {
    if (!activeShift) return;
    try {
      const res = await api.put(`/api/waitershift/${activeShift.id}/end`, {
        unassignOrders: true,
        transferToWaiterId: endShiftTransferTo || null
      });
      setShiftResult(res.data);
      setShiftStep(3);
      setActiveShift(null);
      const uid = getUserId(user);
      if (uid) loadData(uid);
    } catch {
      toast.error('Error al cerrar turno');
    }
  };

  const closeShiftModal = () => {
    setShowEndShiftModal(false);
    setShiftStep(1);
    setShiftSummary(null);
    setShiftResult(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('waiter_token');
    localStorage.removeItem('waiter_user');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Bar KDS separado: personal de bar usa admin-panel /bar. Waiter App solo muestra flujo de mesero (nunca entra aquí).
  if (user && isBartender(user)) {
    const getOrderStatus = (o: any) => o?.status ?? o?.Status ?? '';
    const getOrderItems = (o: any) => o?.items ?? o?.Items ?? [];
    const getItemDishName = (i: any) => i?.dishName ?? i?.DishName ?? '';
    const barOrders = barOrdersRaw.filter((o: any) =>
      ['Pending', 'Confirmed', 'Preparing', 'Ready'].includes(getOrderStatus(o))
    ).map((o: any) => ({
      ...o,
      drinkItems: getOrderItems(o).filter((i: any) => isDrinkItem(getItemDishName(i)))
    })).filter((o: any) => (o.drinkItems?.length ?? 0) > 0);
    const queueCount = barOrders.length;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wine className="h-8 w-8 text-amber-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Bar KDS</h1>
                  <p className="text-sm text-gray-600">Cola de bebidas · {user?.firstName || user?.FirstName || 'Bartender'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadBarOrders}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <LogOut className="w-4 h-4" />
                  Salir
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pedidos en cola: {queueCount}</h2>
          <p className="text-sm text-gray-600 mb-6">Bebidas pendientes de preparación</p>
          {queueCount === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Wine className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <p className="text-lg text-gray-600">No hay bebidas pendientes</p>
              <p className="text-sm text-gray-500">Los nuevos pedidos aparecerán aquí</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {barOrders.map((order: any) => {
                const elapsed = getElapsedMinutes(order.createdAt ?? order.CreatedAt);
                const isUrgent = elapsed > 20;
                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-lg shadow border-2 p-4 ${isUrgent ? 'border-red-500 bg-red-50/50' : 'border-amber-200 bg-amber-50/30'}`}
                  >
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                      <span className="text-xl font-bold">Mesa {order.tableNumber ?? order.TableNumber ?? '-'}</span>
                      <span className={`font-mono font-bold px-2 py-1 rounded text-sm ${isUrgent ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>
                        {elapsed}m
                      </span>
                    </div>
                    <div className="space-y-3 mb-4">
                      {(order.drinkItems ?? []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white border">
                          <span className="font-medium">{item.quantity ?? 0}x {getItemDishName(item)}</span>
                          {(item.notes ?? item.Notes) && <span className="text-xs text-gray-500">{item.notes ?? item.Notes}</span>}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {!(order.barPreparing ?? order.BarPreparing) ? (
                        <button
                          onClick={() => setBarPreparing(order.id)}
                          className="flex-1 py-2 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center justify-center gap-2"
                        >
                          <Clock className="w-5 h-5" />
                          Preparando
                        </button>
                      ) : !(order.barReady ?? order.BarReady) ? (
                        <button
                          onClick={() => setBarReady(order.id)}
                          className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                        >
                          <Check className="w-5 h-5" />
                          Listo
                        </button>
                      ) : (
                        <button
                          disabled
                          className="flex-1 py-2 px-4 bg-gray-300 text-gray-600 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <Check className="w-5 h-5" />
                          Bebidas listas
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Waiter App</h1>
              <p className="text-sm text-gray-600">Bienvenido, {user?.firstName || user?.name || 'Usuario'}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Estadísticas */}
              <div className="flex gap-4 mr-6">
                <div className="bg-green-50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Ventas</p>
                  <p className="text-lg font-bold text-green-700">RD$ {stats.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Propinas</p>
                  <p className="text-lg font-bold text-blue-700">RD$ {stats.totalTips.toFixed(2)}</p>
                </div>
              </div>
              {/* Campana de notificaciones */}
              <button
                onClick={() => { setShowNotifPanel(v => !v); if (!showNotifPanel) markAllRead(); }}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Notificaciones"
              >
                <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-amber-500 animate-bounce' : 'text-gray-500'}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Shift controls */}
              {!activeShift ? (
                <button
                  onClick={startShift}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-semibold"
                >
                  <Play className="w-4 h-4" />
                  Iniciar Turno
                </button>
              ) : (
                <button
                  onClick={openEndShiftModal}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-semibold"
                >
                  <Square className="w-3.5 h-3.5" />
                  Cerrar Turno
                  <span className="text-xs opacity-80 ml-1">
                    ({Math.round((Date.now() - new Date(activeShift.startTime).getTime()) / 60000)} min)
                  </span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SHIFT HANDOVER MODAL ═══ */}
      {showEndShiftModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className={`px-6 py-4 flex-shrink-0 ${shiftStep === 3 ? 'bg-emerald-600' : 'bg-amber-500'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {shiftStep === 1 && 'Resumen de Turno'}
                    {shiftStep === 2 && 'Traspaso de Mesas'}
                    {shiftStep === 3 && '¡Turno Cerrado!'}
                  </h2>
                  {activeShift && shiftStep !== 3 && (
                    <p className="text-sm text-white/80 mt-0.5">
                      Iniciado a las {new Date(activeShift.startTime).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{Math.round((Date.now() - new Date(activeShift.startTime).getTime()) / 60000)} min
                    </p>
                  )}
                </div>
                {/* Step indicators */}
                {shiftStep !== 3 && (
                  <div className="flex gap-1.5">
                    {[1, 2].map(s => (
                      <div key={s} className={`w-2.5 h-2.5 rounded-full transition-all ${shiftStep >= s ? 'bg-white' : 'bg-white/30'}`} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* STEP 1: Resumen */}
              {shiftStep === 1 && (
                <>
                  {shiftLoadingModal ? (
                    <div className="text-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Cargando resumen...</p>
                    </div>
                  ) : shiftSummary ? (
                    <>
                      {/* Alerta si hay cuentas por cobrar */}
                      {shiftSummary.pendingBillingCount > 0 && (
                        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
                          <span className="text-orange-500 text-lg">⚠️</span>
                          <p className="text-sm text-orange-700 font-medium">
                            Tienes {shiftSummary.pendingBillingCount} mesa{shiftSummary.pendingBillingCount !== 1 ? 's' : ''} con cuenta pendiente de cobro.
                          </p>
                        </div>
                      )}

                      {/* Mesas activas */}
                      {shiftSummary.activeTables?.length > 0 ? (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Mesas abiertas ({shiftSummary.activeTables.length})
                          </p>
                          <div className="space-y-2">
                            {shiftSummary.activeTables.map((t: any) => (
                              <div key={t.orderId} className="border border-gray-200 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800">Mesa {t.tableNumber}</span>
                                    <span className="text-xs text-gray-400">{t.zoneName}</span>
                                    {t.hasPendingPayment && (
                                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">Por cobrar</span>
                                    )}
                                  </div>
                                  <span className="font-bold text-gray-800">${t.total.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>{t.itemCount} plato{t.itemCount !== 1 ? 's' : ''}{t.customerName ? ` · ${t.customerName}` : ''}</span>
                                  {t.tip > 0 && <span className="text-emerald-600 font-medium">Propina: ${t.tip.toFixed(2)}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <p className="text-sm text-gray-500">No tienes mesas abiertas.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-6">No se pudo cargar el resumen.</p>
                  )}
                </>
              )}

              {/* STEP 2: Transferencia */}
              {shiftStep === 2 && (
                <>
                  {shiftSummary?.activeTables?.length > 0 ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Tienes <strong>{shiftSummary.activeTables.length} mesa{shiftSummary.activeTables.length !== 1 ? 's' : ''} abiertas</strong>.
                        Selecciona a quién se las entregas:
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                          style={{ borderColor: endShiftTransferTo === null ? '#f59e0b' : '#e5e7eb' }}>
                          <input type="radio" name="shiftTransfer" checked={endShiftTransferTo === null}
                            onChange={() => setEndShiftTransferTo(null)} className="accent-amber-500" />
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Dejar sin asignar</p>
                            <p className="text-xs text-gray-400">Cualquier mesero podrá reclamarlas</p>
                          </div>
                        </label>
                        {waiterList.filter(w => w.id !== getUserId(user)).map(w => (
                          <label key={w.id} className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderColor: endShiftTransferTo === w.id ? '#f59e0b' : '#e5e7eb' }}>
                            <input type="radio" name="shiftTransfer" checked={endShiftTransferTo === w.id}
                              onChange={() => setEndShiftTransferTo(w.id)} className="accent-amber-500" />
                            <div>
                              <p className="text-sm font-semibold text-gray-700">{w.firstName} {w.lastName}</p>
                              <p className="text-xs text-gray-400">Transferir {shiftSummary.activeTables.length} mesa{shiftSummary.activeTables.length !== 1 ? 's' : ''}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="bg-emerald-50 rounded-xl p-4 text-center">
                      <p className="text-2xl mb-2">✅</p>
                      <p className="text-sm font-semibold text-emerald-700">No tienes mesas abiertas.</p>
                      <p className="text-xs text-emerald-600 mt-1">Puedes cerrar el turno directamente.</p>
                    </div>
                  )}
                </>
              )}

              {/* STEP 3: Resultado */}
              {shiftStep === 3 && shiftResult && (
                <div className="text-center space-y-5">
                  <div className="text-5xl">✅</div>
                  <div>
                    <p className="text-lg font-bold text-gray-800">Turno cerrado</p>
                    <p className="text-sm text-gray-500 mt-1">Duración: {shiftResult.durationFormatted}</p>
                  </div>
                  {shiftResult.transferredTables > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-1">
                      <p className="text-sm font-bold text-amber-700">
                        {shiftResult.transferredTables} mesa{shiftResult.transferredTables !== 1 ? 's' : ''} y pedidos activos traspasados
                      </p>
                      {shiftResult.transferredTo ? (
                        <p className="text-sm text-amber-600">Entregadas a <strong>{shiftResult.transferredTo}</strong></p>
                      ) : (
                        <p className="text-sm text-amber-600">Dejadas disponibles para reclamar</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4">
                      <p className="text-sm font-semibold text-emerald-700">No había mesas abiertas al cerrar.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex-shrink-0 px-6 pb-6 pt-2 flex gap-3">
              {shiftStep === 1 && (
                <>
                  <button onClick={closeShiftModal} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-semibold">
                    Cancelar
                  </button>
                  <button onClick={() => setShiftStep(2)} disabled={shiftLoadingModal}
                    className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 text-sm font-semibold disabled:opacity-50">
                    Continuar →
                  </button>
                </>
              )}
              {shiftStep === 2 && (
                <>
                  <button onClick={() => setShiftStep(1)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-semibold">
                    ← Atrás
                  </button>
                  <button onClick={endShift} className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 text-sm font-semibold">
                    Confirmar cierre
                  </button>
                </>
              )}
              {shiftStep === 3 && (
                <button onClick={closeShiftModal} className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 text-sm font-semibold">
                  Listo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel de notificaciones */}
      {showNotifPanel && (
        <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-gray-900 text-lg">Notificaciones</h2>
              {!connected && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Sin conexión</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50">
                  Limpiar todo
                </button>
              )}
              <button onClick={() => setShowNotifPanel(false)} className="p-1 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Bell className="w-16 h-16 text-gray-200 mb-4" />
                <p className="text-gray-500 font-medium">Sin notificaciones</p>
                <p className="text-sm text-gray-400 mt-1">Las alertas de tus mesas aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((n: WaiterNotification) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 p-4 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg
                      ${n.type === 'kitchen_ready' ? 'bg-amber-100' : n.type === 'bar_ready' ? 'bg-sky-100' : n.type === 'items_added' ? 'bg-purple-100' : 'bg-green-100'}`}
                    >
                      {n.type === 'kitchen_ready' ? '🍽️' : n.type === 'bar_ready' ? '🍹' : n.type === 'items_added' ? '➕' : '✅'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {n.timestamp.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors self-start"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {showNotifPanel && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowNotifPanel(false)} />
      )}

      {/* View Toggle + Acciones */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center gap-3">
        <div className="bg-white rounded-lg shadow p-1 inline-flex">
          <button
            onClick={() => setView('general')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              view === 'general' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Mesas General ({(() => {
              const vtTableIds = virtualTablesList.flatMap((vt: any) => {
                const vtTables = Array.isArray(vt?.tables) ? vt.tables : (Array.isArray(vt?.Tables) ? vt.Tables : []);
                return vtTables.map((t: any) => t?.id ?? t?.Id);
              });
              return generalOrders.filter(o => !vtTableIds.includes((o as any).tableId ?? (o as any).TableId)).length;
            })()})
          </button>
          <button
            onClick={() => setView('my-tables')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              view === 'my-tables' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Mis Mesas ({myOrders.length})
          </button>
        </div>
        <button
          onClick={() => { setShowQrModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <QrCode className="w-5 h-5" />
          Identificar mesa por QR
        </button>
        <button
          onClick={() => { setShowVirtualTableModal(true); loadVirtualTables(); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          <Users className="w-5 h-5" />
          Crear mesa virtual
        </button>
        <button
          onClick={() => { setShowTransferModal(true); loadWaiters(); loadPendingTransfers(); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 relative"
        >
          <Share2 className="w-5 h-5" />
          Transferir mesas
          {pendingTransfers.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingTransfers.length}</span>
          )}
        </button>
        {identifiedTableId != null && (
          <button
            onClick={() => { setIdentifiedTableId(null); }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cerrar vista mesa
          </button>
        )}
      </div>

      {/* Transferencias pendientes (aceptar/rechazar) */}
      {pendingTransfers.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="font-medium text-amber-800 mb-2">Transferencias pendientes de aceptar</p>
            <div className="flex flex-wrap gap-2">
              {pendingTransfers.map((tr: any) => (
                <div key={tr.id} className="flex items-center gap-2 bg-white rounded px-3 py-2 border">
                  <span>{tr.fromWaiterName} → Mesas {Array.isArray(tr.tableIds) ? tr.tableIds.join(', ') : ''}</span>
                  <button onClick={() => acceptTransfer(tr.id)} className="text-green-600 font-medium">Aceptar</button>
                  <button onClick={() => rejectTransfer(tr.id)} className="text-red-600 font-medium">Rechazar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vista mesa identificada por QR: pedidos en tiempo real + pedido manual */}
      {identifiedTableId != null && (
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <div className="bg-white rounded-lg shadow border-2 border-indigo-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">
                Mesa identificada: {tables.find(t => t.id === identifiedTableId)?.tableNumber ?? identifiedTableId}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => openManualOrder(identifiedTableId)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Utensils className="w-4 h-4" />
                  Hacer pedido manual
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-2">Pedidos de esta mesa (en tiempo real):</p>
            <div className="space-y-2">
              {[...generalOrders, ...myOrders]
                .filter(o => ((o as any).tableId ?? (o as any).TableId) === identifiedTableId)
                .map((o: Order) => (
                  <div key={getOrderId(o)} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                    <span className="font-mono">{o.orderNumber ?? (o as any).orderNumber}</span>
                    <span className={getOrderStatusColor((o as any).status ?? o.status)}>{(o as any).status ?? o.status}</span>
                    <span>RD$ {((o as any).total ?? o.total ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              {[...generalOrders, ...myOrders].filter(o => ((o as any).tableId ?? (o as any).TableId) === identifiedTableId).length === 0 && (
                <p className="text-gray-500 text-sm">No hay pedidos activos en esta mesa.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {view === 'general' ? (
          // Vista Mesas General
          <div className="space-y-6">
            {/* Todas las Mesas: solo mesas sin orden asignada a mí (las mías aparecen en "Mis Mesas") */}
            <div>
              {(() => {
                // Obtener IDs de mesas que están en mesas virtuales
                const virtualTableIds = virtualTablesList.flatMap(vt => {
                  const vtTables = Array.isArray(vt?.tables) ? vt.tables : (Array.isArray(vt?.Tables) ? vt.Tables : []);
                  return vtTables.map((t: any) => t?.id ?? t?.Id);
                });
                
                console.log('🔍 FILTRO TODAS LAS MESAS - IDs en virtuales:', virtualTableIds);
                
                const tablesNotMine = tables.filter(t => {
                  const inMyOrders = myOrders.some(o => String(o.tableNumber) === String(t.tableNumber));
                  const inVirtualTable = virtualTableIds.includes(t.id);
                  
                  if (inVirtualTable) {
                    console.log('🔍 FILTRO TODAS LAS MESAS - Mesa', t.tableNumber, 'está en virtual table, excluyendo');
                  }
                  
                  return !inMyOrders && !inVirtualTable;
                });
                
                console.log('🔍 FILTRO TODAS LAS MESAS - Mesas a mostrar:', tablesNotMine.length);
                
                return (
                  <>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Todas las Mesas ({tablesNotMine.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tablesNotMine.map((table) => {
                  const unassignedOrder = generalOrders.find(o => String(o.tableNumber) === String(table.tableNumber));
                  const hasUnassigned = !!unassignedOrder;

                  return (
                    <div
                      key={table.id}
                      className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        table.status === 'Occupied'
                          ? 'border-red-500 bg-red-50'
                          : table.status === 'Reserved'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-green-500 bg-green-50'
                      }`}
                      onClick={() => {
                        if (hasUnassigned) {
                          setOrderModalOrder(unassignedOrder);
                          setShowOrderModal(true);
                        }
                      }}
                    >
                      <div className="text-center">
                        <div className="text-3xl font-bold mb-1 flex items-center justify-center gap-1">
                          #{table.tableNumber}
                          {hasUnassigned && (
                            <span className="text-red-600 animate-pulse" style={{ animationDuration: '0.7s' }} title="Pedido sin asignar">!</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">{table.zoneName}</div>
                        <div className="text-xs font-medium">
                          {hasUnassigned ? (
                            <span className="text-red-600 flex items-center justify-center gap-1 font-semibold">
                              <AlertExclamation />
                              Pedido nuevo
                            </span>
                          ) : (
                            <span className="text-gray-500">Sin orden</span>
                          )}
                        </div>
                      </div>
                      {hasUnassigned && (
                        <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center animate-pulse" style={{ animationDuration: '0.8s' }}>
                          <span className="text-white text-sm font-bold">!</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          // Vista Mis Mesas (Asignadas)
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Mis Mesas Asignadas
            </h2>
            {(() => {
              // Filtrar órdenes que NO estén en mesas virtuales
              const virtualTableIds = virtualTablesList.flatMap(vt => {
                const vtTables = Array.isArray(vt?.tables) ? vt.tables : (Array.isArray(vt?.Tables) ? vt.Tables : []);
                return vtTables.map((t: any) => t?.id ?? t?.Id);
              });
              
              console.log('🔍 FILTRO - IDs de mesas en virtuales:', virtualTableIds);
              
              const filteredMyOrders = myOrders.filter(o => {
                const tId = (o as any).tableId ?? (o as any).TableId;
                const isInVirtual = virtualTableIds.includes(tId);
                if (isInVirtual) {
                  console.log('🔍 FILTRO - Orden', o.orderNumber, 'de mesa', tId, 'está en mesa virtual, excluyendo');
                }
                return !isInVirtual;
              });
              
              console.log('🔍 FILTRO - myOrders originales:', myOrders.length);
              console.log('🔍 FILTRO - myOrders filtradas:', filteredMyOrders.length);
              
              return filteredMyOrders.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">No tienes mesas asignadas</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredMyOrders.map((order) => {
                    const hasAllergies = (order.items ?? []).some((i: any) => (i.allergies ?? i.Allergies ?? '').trim());
                    const kitchenReady = (order as any).kitchenReady ?? (order as any).KitchenReady;
                    const barReady = (order as any).barReady ?? (order as any).BarReady;
                    const kitchenServed = (order as any).kitchenServed ?? (order as any).KitchenServed;
                    const barServed = (order as any).barServed ?? (order as any).BarServed;
                    const hasFoodItems = (order.items ?? []).some((i: any) => !isDrinkItem(i.dishName ?? i.DishName ?? ''));
                    const hasDrinkItems = (order.items ?? []).some((i: any) => isDrinkItem(i.dishName ?? i.DishName ?? ''));
                    const readyToServe = (kitchenReady || !hasFoodItems) && (barReady || !hasDrinkItems);
                    const isPaid = (order as Order).paymentCollectedByWaiter || order.status === 'Completed';

                    return (
                      <div
                        key={getOrderId(order)}
                        onClick={() => { setMyOrderModalOrder(order); setMyOrderModalTab(hasFoodItems ? 'kitchen' : 'bar'); setShowMyOrderModal(true); }}
                        className={`bg-white rounded-xl shadow border-2 p-3 cursor-pointer hover:shadow-md transition-all ${
                          readyToServe && order.status !== 'Served' && order.status !== 'Completed'
                            ? 'border-green-500 bg-green-50/30'
                            : order.status === 'Served' || order.status === 'Completed'
                            ? 'border-teal-400 bg-teal-50/30'
                            : 'border-gray-200 hover:border-primary-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span className="text-2xl font-bold text-gray-900">#{order.tableNumber}</span>
                          <div className="flex items-center gap-1">
                            {claimedTableIds.has((order as any).tableId ?? (order as any).TableId) && (
                              <button
                                title="Mesa reclamada — click para soltar"
                                onClick={(e) => { e.stopPropagation(); setAbandonConfirmOrder(order); }}
                                className="p-1 rounded-full text-indigo-500 hover:bg-indigo-50 transition-colors"
                              >
                                <Pin className="w-3.5 h-3.5 fill-indigo-500" />
                              </button>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getOrderStatusColor(order.status)}`}>{order.status}</span>
                          </div>
                        </div>
                        {(order as any).customerName && (
                          <p className="text-xs text-primary-600 font-medium truncate mb-1">{(order as any).customerName}</p>
                        )}
                        <p className="text-xs text-gray-400 font-mono truncate mb-2">{order.orderNumber?.split('-').slice(-1)[0]}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-800">RD$ {((order as any).total ?? 0).toFixed(0)}</p>
                          <div className="flex gap-1">
                            {hasFoodItems && <span title="Cocina" className={`text-xs px-1.5 py-0.5 rounded font-bold ${kitchenServed ? 'bg-teal-100 text-teal-700' : kitchenReady ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>🍽</span>}
                            {hasDrinkItems && <span title="Bar" className={`text-xs px-1.5 py-0.5 rounded font-bold ${barServed ? 'bg-teal-100 text-teal-700' : barReady ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>🍹</span>}
                            {hasAllergies && <span title="Alergias" className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold">⚠</span>}
                          </div>
                        </div>
                        {readyToServe && order.status !== 'Served' && order.status !== 'Completed' && !((!hasFoodItems || kitchenServed) && (!hasDrinkItems || barServed)) && (
                          <p className="text-xs text-green-700 font-semibold mt-1 text-center">✓ Listo para servir</p>
                        )}
                        {/* Botón Marcar Servida: solo cuando ya se sirvió todo */}
                        {(!hasFoodItems || kitchenServed) && (!hasDrinkItems || barServed) && order.status !== 'Served' && order.status !== 'Completed' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const oid = getOrderId(order);
                              try {
                                await api.put(`/api/order/${oid}/status`, { newStatus: 'Served' });
                                toast.success('Orden marcada como servida ✓');
                                loadData(getUserId(user));
                                loadVirtualTables();
                              } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al marcar como servida'); }
                            }}
                            className="w-full mt-2 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center justify-center gap-1"
                          >
                            ✅ Marcar como Servida
                          </button>
                        )}
                        {/* Liberar Mesa: aparece cuando está Served o Completed, habilitado solo si ya cobró */}
                        {(order.status === 'Served' || order.status === 'Completed') && (
                          <button
                            disabled={!isPaid}
                            onClick={async (e) => {
                              e.stopPropagation();
                              releaseTable((order as any).tableId ?? (order as any).TableId);
                            }}
                            className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                              isPaid
                                ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                            title={!isPaid ? 'Debe cobrar antes de liberar la mesa' : ''}
                          >
                            🔓 Liberar Mesa{!isPaid ? ' (pendiente cobro)' : ''}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Sección Mesas Virtuales */}
            {virtualTablesList.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">🔗 Mesas Virtuales</h3>
                <div className="space-y-3">
                  {virtualTablesList.map((vt: any) => {
                    const vtId = vt?.id ?? vt?.Id;
                    const vtName = vt?.name ?? vt?.Name ?? `Mesa Virtual #${vtId}`;
                    const vtTables = Array.isArray(vt?.tables) ? vt.tables : (Array.isArray(vt?.Tables) ? vt.Tables : []);
                    
                    // Encontrar órdenes de esta mesa virtual (asignadas y no asignadas)
                    const vtTableIds = vtTables.map((t: any) => t?.id ?? t?.Id);
                    const vtOrders = [
                      ...myOrders.filter(o => {
                        const tId = (o as any).tableId ?? (o as any).TableId;
                        return vtTableIds.includes(tId);
                      }),
                      ...generalOrders.filter(o => {
                        const tId = (o as any).tableId ?? (o as any).TableId;
                        return vtTableIds.includes(tId);
                      })
                    ];
                    const totalVT = vtOrders.reduce((sum, o) => sum + ((o as any).total ?? (o as any).totalAmount ?? 0), 0);
                    
                    return (
                      <div key={vtId} className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-400 rounded-lg shadow-md p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg text-purple-900">{vtName}</p>
                            <p className="text-xs text-purple-700">{vtTables.length} mesas unidas</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{vtOrders.length} orden(es)</p>
                            <p className="text-xl font-bold text-purple-900">RD$ {totalVT.toFixed(2)}</p>
                          </div>
                        </div>
                        
                        {/* Chips de las mesas individuales */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {vtTables.map((t: any) => (
                            <div key={t?.id ?? t?.Id} className="px-3 py-1 bg-purple-100 border-2 border-purple-400 rounded-md">
                              <div className="text-sm font-bold text-purple-900">#{t?.tableNumber ?? t?.TableNumber ?? '?'}</div>
                              <div className="text-xs text-purple-700">{t?.zoneName ?? t?.ZoneName ?? ''}</div>
                            </div>
                          ))}
                        </div>

                        {/* Resumen rápido */}
                        <div className="bg-purple-100 rounded-lg p-2 mb-3 text-xs text-purple-800">
                          {vtOrders.length > 0 ? (
                            <span>{vtOrders.length} orden(es) activa(s) · Total: RD$ {totalVT.toFixed(2)}</span>
                          ) : (
                            <span>Sin órdenes activas</span>
                          )}
                        </div>

                        {/* Botones de acción */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedVTTableIndex(0); // Reset al abrir
                              setShowVirtualTableDetailsModal(vt);
                            }}
                            className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
                          >
                            Ver detalles
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (confirm(`¿Deshacer la mesa virtual "${vtName}"?`)) {
                                deleteVirtualTable(vtId);
                              }
                            }}
                            className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                          >
                            Deshacer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Pedido sin asignar (al hacer clic en mesa con alarma) */}
      {showOrderModal && orderModalOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowOrderModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-600 font-bold text-xl animate-pulse" style={{ animationDuration: '0.8s' }}>!</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Pedido sin asignar</h2>
                  <p className="text-sm text-gray-600">Mesa {orderModalOrder.tableNumber} · {orderModalOrder.orderNumber}</p>
                  {(orderModalOrder as any).customerName && (
                    <p className="text-xs text-primary-600 font-medium mt-0.5">Cliente: {(orderModalOrder as any).customerName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            {(() => {
              const items = orderModalOrder.items ?? [];
              const hasAllergies = items.some((i: any) => (i.allergies ?? i.Allergies ?? '').trim());
              const allergiesList = [...new Set(items.map((i: any) => (i.allergies ?? i.Allergies ?? '').trim()).filter(Boolean))];
              return (
                <>
                  {hasAllergies && allergiesList.length > 0 && (
                    <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="text-red-800 font-semibold text-sm uppercase">ALERGIA: {allergiesList.join(', ')}</span>
                    </div>
                  )}
                  <div className="mb-4 space-y-2">
                    {items.map((item: any, idx: number) => (
                      <div key={idx} className="text-sm rounded-lg bg-gray-50 p-2 border border-gray-100">
                        <div className="font-medium text-gray-800">{item.quantity}x {item.dishName ?? item.DishName}</div>
                        {(item.notes ?? item.Notes ?? item.customizations ?? item.Customizations ?? item.allergies ?? item.Allergies ?? item.sideDish ?? item.SideDish ?? item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking) && (
                          <div className="mt-1 text-xs text-gray-600 space-y-0.5 pl-1 border-l-2 border-amber-200">
                            {(item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking) ? <div>🔥 Preferencia / Término: {item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking}</div> : null}
                            {item.sideDish ?? item.SideDish ? <div>Guarnición: {item.sideDish ?? item.SideDish}</div> : null}
                            {item.notes ?? item.Notes ? <div>Notas: {item.notes ?? item.Notes}</div> : null}
                            {item.customizations ?? item.Customizations ? <div>Personalización: {item.customizations ?? item.Customizations}</div> : null}
                            {item.allergies ?? item.Allergies ? <div className="text-red-700 font-medium">⚠ Alergia: {item.allergies ?? item.Allergies}</div> : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            <div className="flex items-center justify-between mb-4 pt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(orderModalOrder.status)}`}>
                {orderModalOrder.status}
              </span>
              <p className="text-lg font-bold text-gray-900">RD$ {((orderModalOrder as any).total ?? (orderModalOrder as any).totalAmount ?? 0).toFixed(2)}</p>
            </div>
            {(() => {
              const orderTableId = (orderModalOrder as any).tableId ?? (orderModalOrder as any).TableId;
              const isVirtualTableOrder = virtualTablesList.some((vt: any) => {
                const vtTables = Array.isArray(vt?.tables) ? vt.tables : (Array.isArray(vt?.Tables) ? vt.Tables : []);
                return vtTables.some((t: any) => (t?.id ?? t?.Id) === orderTableId);
              });
              return (
                <button
                  onClick={async () => {
                    const ok = await confirmOrder(orderModalOrder);
                    if (ok) {
                      setShowOrderModal(false);
                      setOrderModalOrder(null);
                    }
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  {isVirtualTableOrder ? 'Confirmar' : 'Confirmar y Asignar a Mí'}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Cobrar expandido: división de cuenta, método de pago, propina */}
      {showPaymentModal && selectedOrder && (() => {
        const so = selectedOrder as any;
        const orderTotal    = Number(so.total ?? so.totalAmount ?? 0);
        const orderSubtotal = Number(so.subtotal ?? so.Subtotal ?? 0);
        const orderTax      = Number(so.tax ?? so.Tax ?? 0);
        const orderItems: any[] = so.items ?? [];
        const taxRate = orderSubtotal > 0 ? orderTax / orderSubtotal : 0.18;

        // Totales por categoría
        const catTotals: Record<string, number> = {};
        orderItems.forEach((item: any) => {
          const cat = item.categoryName ?? item.CategoryName ?? 'Otros';
          const sub = Number(item.subtotal ?? item.Subtotal ?? 0);
          catTotals[cat] = (catTotals[cat] ?? 0) + sub;
        });
        Object.keys(catTotals).forEach(c => { catTotals[c] = catTotals[c] + catTotals[c] * taxRate; });

        // Porción a cobrar según split
        let myPortion = orderTotal;
        if (pmSplitType === 'ByComensal' && pmSplitParts > 0) {
          myPortion = orderTotal / pmSplitParts;
        } else if (pmSplitType === 'ByTime') {
          myPortion = pmByTimePayPart === 1 ? (parseFloat(pmByTimePart1) || 0) : (parseFloat(pmByTimePart2) || 0);
          if (myPortion <= 0) myPortion = orderTotal;
        } else if (pmSplitType === 'Proportional' && pmSplitParts > 0) {
          const perPerson: Record<number, number> = {};
          for (let i = 1; i <= pmSplitParts; i++) perPerson[i] = 0;
          orderItems.forEach((item: any) => {
            const sub = Number(item.subtotal ?? item.Subtotal ?? 0);
            const p = pmPropAssign[item.id ?? item.Id] ?? 1;
            perPerson[p] = (perPerson[p] ?? 0) + sub;
          });
          const subtotalP = perPerson[pmPayAsPerson] ?? 0;
          myPortion = subtotalP + subtotalP * taxRate;
        } else if (pmSplitType === 'ByCategory' && pmPayCategory) {
          myPortion = catTotals[pmPayCategory] ?? 0;
        }

        const tipAmt = pmTipPct > 0
          ? myPortion * (pmTipPct / 100)
          : (pmCustomTip ? parseFloat(pmCustomTip) || 0 : 0);

        const grandTotal = myPortion + (pmMethod !== 'Mixed' ? tipAmt : 0);

        const mixedTotal = (parseFloat(pmMixedCash) || 0) + (parseFloat(pmMixedCard) || 0) + (parseFloat(pmMixedTransfer) || 0);

        const clientMethod = so.clientRequestedPaymentMethod ?? so.ClientRequestedPaymentMethod;
        const clientTipPct = Number(so.clientTipPercentage ?? so.ClientTipPercentage ?? 0);
        const clientTipAmt = Number(so.clientTipAmount ?? so.ClientTipAmount ?? 0);

        return (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Cobrar — Mesa {selectedOrder.tableNumber}</h2>
                    <p className="text-sm text-gray-500">Orden #{selectedOrder.orderNumber}</p>
                  </div>
                  <button
                    onClick={() => { setShowPaymentModal(false); setSelectedOrder(null); }}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
                  >×</button>
                </div>
              </div>

              <div className="p-5 space-y-5">

                {/* Preferencias del cliente */}
                {(() => {
                  const clientFiscal = so.clientRequiresFiscalReceipt ?? so.ClientRequiresFiscalReceipt ?? false;
                  const clientRNC    = so.clientRNC ?? so.ClientRNC ?? '';
                  const clientBiz    = so.clientBusinessName ?? so.ClientBusinessName ?? '';
                  const hasPrefs     = clientMethod || clientTipPct > 0 || clientTipAmt > 0 || clientFiscal;
                  if (!hasPrefs) return null;
                  return (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm space-y-2">
                      <p className="font-semibold text-indigo-800">Preferencias del cliente</p>
                      <div className="flex flex-wrap gap-3 text-indigo-700">
                        {clientMethod && <span>Método: <strong>{clientMethod === 'Cash' ? 'Efectivo' : clientMethod === 'Card' ? 'Tarjeta' : clientMethod === 'Transfer' ? 'Transferencia' : 'Mixto'}</strong></span>}
                        {clientTipPct > 0 && <span>Propina: <strong>{clientTipPct}%</strong></span>}
                        {clientTipPct === 0 && clientTipAmt > 0 && <span>Propina: <strong>RD$ {clientTipAmt.toFixed(2)}</strong></span>}
                      </div>
                      {clientFiscal && (
                        <div className="flex items-start gap-2 pt-2 border-t border-indigo-200 text-indigo-800">
                          <span className="text-base">📄</span>
                          <div>
                            <span className="font-semibold">Comprobante fiscal solicitado</span>
                            {clientRNC && <span className="ml-2 text-indigo-600">RNC: <strong>{clientRNC}</strong></span>}
                            {clientBiz && <p className="text-indigo-700 font-medium mt-0.5">{clientBiz}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Resumen de la orden */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Resumen</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto mb-2">
                    {orderItems.map((item: any, idx: number) => (
                      <div key={item.id ?? idx} className="flex justify-between text-sm text-gray-700">
                        <span>{item.quantity}x {item.dishName ?? item.DishName}</span>
                        <span>RD$ {Number(item.subtotal ?? item.Subtotal ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>RD$ {orderSubtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>ITBIS (18%)</span><span>RD$ {orderTax.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t">
                      <span>Total</span><span className="text-green-700">RD$ {orderTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* División de cuenta */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">División de cuenta</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {([
                      { value: 'None',         label: 'Cuenta única' },
                      { value: 'ByComensal',   label: 'Por comensal' },
                      { value: 'ByTime',       label: 'Por parte' },
                      { value: 'Proportional', label: 'Proporcional' },
                      { value: 'ByCategory',   label: 'Por categoría' },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setPmSplitType(value);
                          setPmSplitParts(2);
                          setPmByTimePart1('');
                          setPmByTimePart2('');
                          setPmPropAssign({});
                          setPmPayCategory('');
                          // Si Mixto, resetear al total completo en efectivo cuando vuelve a None
                          if (pmMethod === 'Mixed' && value === 'None') {
                            setPmMixedCash(orderTotal.toFixed(2));
                            setPmMixedCard('');
                            setPmMixedTransfer('');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-sm ${pmSplitType === value ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-700'}`}
                      >{label}</button>
                    ))}
                  </div>

                  {pmSplitType === 'ByComensal' && (
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <label className="text-gray-600">Entre</label>
                      <select value={pmSplitParts} onChange={e => setPmSplitParts(parseInt(e.target.value) || 2)} className="border text-gray-900 rounded px-2 py-1">
                        {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} personas</option>)}
                      </select>
                      <span className="text-gray-600">→ Parte: <strong>RD$ {myPortion.toFixed(2)}</strong></span>
                    </div>
                  )}

                  {pmSplitType === 'ByTime' && (
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-600">Ingresa el monto de cada parte (deben sumar RD$ {orderTotal.toFixed(2)})</p>
                      <div className="flex gap-2 flex-wrap">
                        <input type="number" step="0.01" placeholder="Parte 1" value={pmByTimePart1}
                          onChange={e => { setPmByTimePart1(e.target.value); setPmByTimePart2((orderTotal - (parseFloat(e.target.value) || 0)).toFixed(2)); }}
                          className="border text-gray-900 rounded px-2 py-1 w-36" />
                        <input type="number" step="0.01" placeholder="Parte 2" value={pmByTimePart2}
                          onChange={e => { setPmByTimePart2(e.target.value); setPmByTimePart1((orderTotal - (parseFloat(e.target.value) || 0)).toFixed(2)); }}
                          className="border text-gray-900 rounded px-2 py-1 w-36" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-gray-600">Cobrar:</label>
                        <select value={pmByTimePayPart} onChange={e => setPmByTimePayPart(parseInt(e.target.value) as 1|2)} className="border text-gray-900 rounded px-2 py-1">
                          <option value={1}>Parte 1 — RD$ {(parseFloat(pmByTimePart1) || 0).toFixed(2)}</option>
                          <option value={2}>Parte 2 — RD$ {(parseFloat(pmByTimePart2) || 0).toFixed(2)}</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {pmSplitType === 'Proportional' && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <label className="text-gray-600">Entre</label>
                        <select value={pmSplitParts} onChange={e => { setPmSplitParts(parseInt(e.target.value) || 2); setPmPropAssign({}); }} className="border text-gray-900 rounded px-2 py-1">
                          {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} personas</option>)}
                        </select>
                      </div>
                      <p className="text-gray-700 font-medium">Asigna cada ítem:</p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {orderItems.map((item: any, idx: number) => {
                          const id = item.id ?? item.Id ?? idx;
                          return (
                            <div key={id} className="flex justify-between items-center text-gray-900">
                              <span className="truncate flex-1 text-xs">{item.quantity}x {item.dishName ?? item.DishName}</span>
                              <select value={pmPropAssign[id] ?? 1} onChange={e => setPmPropAssign(prev => ({ ...prev, [id]: parseInt(e.target.value) }))} className="border text-gray-900 rounded px-1 py-0.5 text-xs w-24 ml-2">
                                {Array.from({ length: pmSplitParts }, (_, i) => i+1).map(n => <option key={n} value={n}>Persona {n}</option>)}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-gray-600">Cobrar persona</label>
                        <select value={pmPayAsPerson} onChange={e => setPmPayAsPerson(parseInt(e.target.value))} className="border text-gray-900 rounded px-2 py-1">
                          {Array.from({ length: pmSplitParts }, (_, i) => i+1).map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className="text-gray-600">→ <strong>RD$ {myPortion.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  )}

                  {pmSplitType === 'ByCategory' && (
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-700 font-medium">Elige la categoría a cobrar:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(catTotals).map(([cat, total]) => (
                          <button key={cat} type="button" onClick={() => setPmPayCategory(cat)}
                            className={`px-3 py-1.5 rounded-lg border text-sm ${pmPayCategory === cat ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700'}`}>
                            {cat}: RD$ {total.toFixed(2)}
                          </button>
                        ))}
                      </div>
                      {pmPayCategory && <p className="text-gray-600">Cobrar <strong>{pmPayCategory}</strong>: <strong>RD$ {myPortion.toFixed(2)}</strong></p>}
                    </div>
                  )}
                </div>

                {/* Propina */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Propina</p>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[{pct:10,label:'10%'},{pct:15,label:'15%'},{pct:20,label:'20%'},{pct:0,label:'Sin'}].map(({pct,label}) => (
                      <button key={label} type="button"
                        onClick={() => { setPmTipPct(pct); setPmCustomTip(''); }}
                        className={`py-2 rounded-lg border text-sm font-semibold ${pmTipPct === pct && !pmCustomTip ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <input type="number" placeholder="Monto personalizado..." value={pmCustomTip}
                    onChange={e => { setPmCustomTip(e.target.value); setPmTipPct(0); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500" />
                  {tipAmt > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-sm flex justify-between text-green-800">
                      <span>Propina</span><span className="font-bold">RD$ {tipAmt.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Método de pago */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Método de Pago</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Cash',     name: 'Efectivo' },
                      { id: 'Card',     name: 'Tarjeta' },
                      { id: 'Transfer', name: 'Transferencia' },
                      { id: 'Mixed',    name: 'Mixto' },
                    ].map(m => (
                      <button key={m.id} type="button" onClick={() => setPmMethod(m.id)}
                        className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${pmMethod === m.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700'}`}>
                        {m.name}
                      </button>
                    ))}
                  </div>

                  {pmMethod === 'Mixed' && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-gray-600 font-medium">Distribuye el monto por método:</p>
                      <p className="text-xs text-gray-500">Total a cobrar: RD$ {myPortion.toFixed(2)}</p>
                      {[
                        { label: 'Efectivo',       value: pmMixedCash,     setter: setPmMixedCash },
                        { label: 'Tarjeta',        value: pmMixedCard,     setter: setPmMixedCard },
                        { label: 'Transferencia',  value: pmMixedTransfer, setter: setPmMixedTransfer },
                      ].map(({ label, value, setter }) => (
                        <div key={label} className="flex items-center gap-2">
                          <label className="w-32 text-gray-700">{label}</label>
                          <input type="number" step="0.01" placeholder="0.00" value={value}
                            onChange={e => setter(e.target.value)}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-gray-900 focus:outline-none focus:border-indigo-500" />
                        </div>
                      ))}
                      <div className={`flex justify-between font-semibold pt-1 ${Math.abs(mixedTotal - myPortion) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                        <span>Suma ingresada</span>
                        <span>RD$ {mixedTotal.toFixed(2)} {Math.abs(mixedTotal - myPortion) < 0.01 ? '✓' : `(faltan RD$ ${(myPortion - mixedTotal).toFixed(2)})`}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Total final */}
                {pmMethod !== 'Mixed' && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-sm text-gray-700"><span>A cobrar</span><span>RD$ {myPortion.toFixed(2)}</span></div>
                    {tipAmt > 0 && <div className="flex justify-between text-sm text-green-700"><span>Propina</span><span>RD$ {tipAmt.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                      <span>Total</span><span className="text-indigo-700">RD$ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex gap-3 rounded-b-xl">
                <button
                  onClick={() => { setShowPaymentModal(false); setSelectedOrder(null); }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { if (selectedOrder) collectPayment(selectedOrder); }}
                  disabled={pmProcessing || (pmMethod === 'Mixed' && Math.abs(mixedTotal - myPortion) > 0.01)}
                  title={pmMethod === 'Mixed' && Math.abs(mixedTotal - myPortion) > 0.01 ? `Los montos del pago mixto deben sumar RD$ ${myPortion.toFixed(2)}` : ''}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pmProcessing
                    ? 'Procesando...'
                    : (pmMethod === 'Mixed' && Math.abs(mixedTotal - myPortion) > 0.01)
                      ? `Mixto: falta RD$ ${(myPortion - mixedTotal).toFixed(2)}`
                      : 'Confirmar cobro'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Identificar mesa por QR */}
      {showQrModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Identificar mesa por QR</h2>
            {!showQrCamera ? (
              <>
                <p className="text-sm text-gray-600 mb-4">Escanea el QR con la cámara o ingresa el número (ej. 5 o table-5)</p>
                <button
                  type="button"
                  onClick={() => setShowQrCamera(true)}
                  className="w-full mb-4 py-3 border-2 border-dashed border-indigo-300 rounded-lg text-indigo-600 font-medium flex items-center justify-center gap-2"
                >
                  <QrCode className="w-5 h-5" />
                  Abrir cámara para escanear
                </button>
                <input
                  type="text"
                  value={qrTableInput}
                  onChange={e => setQrTableInput(e.target.value)}
                  placeholder="Número de mesa"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
                />
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation();
                      setShowQrModal(false); 
                      setQrTableInput(''); 
                      setShowQrCamera(false); 
                    }} 
                    className="flex-1 py-2 border border-gray-300 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      identifyTableByQr();
                    }} 
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg"
                  >
                    Identificar
                  </button>
                </div>
              </>
            ) : (
              <>
                <QrScanner
                  singleMode
                  onScan={handleQrScanIdentify}
                  onError={handleQrError}
                  onClose={handleQrClose}
                />
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowQrCamera(false);
                  }} 
                  className="w-full mt-3 py-2 border-2 border-indigo-500 text-indigo-700 rounded-lg font-medium hover:bg-indigo-50"
                >
                  Cerrar cámara
                </button>
                <p className="mt-3 text-xs text-gray-500">O escribe el número manualmente:</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={qrTableInput}
                    onChange={e => setQrTableInput(e.target.value)}
                    placeholder="Nº mesa (ej. 5)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      identifyTableByQr();
                    }} 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
                  >
                    Identificar
                  </button>
                </div>
                <div className="mt-3 flex justify-center">
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation();
                      setShowQrModal(false); 
                      setShowQrCamera(false); 
                      setQrTableInput(''); 
                    }} 
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    Cerrar modal
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Crear mesa virtual */}
      {showVirtualTableModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header fijo */}
            <div className="p-6 pb-3 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Crear mesa virtual</h2>
              <p className="text-sm text-gray-600 mt-1">Escanea QR de cada mesa</p>
            </div>
            
            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              {showVirtualTableCamera ? (
                <div className="space-y-3">
                  <QrScanner
                    singleMode={false}
                    onScan={handleQrScanVirtual}
                    onError={handleQrError}
                  />
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800 font-medium">
                      Escanea cada mesa. Cuando termines, revisa la lista abajo y haz clic en "Crear mesa virtual".
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowVirtualTableCamera(true);
                  }}
                  className="w-full py-3 border-2 border-dashed border-amber-300 rounded-lg text-amber-700 font-medium flex items-center justify-center gap-2 hover:bg-amber-50"
                >
                  <QrCode className="w-5 h-5" />
                  Abrir cámara para escanear
                </button>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Nota:</strong> Necesitas al menos 2 mesas para crear una mesa virtual.
                  </p>
                </div>
              </div>
              )}

              {/* Chips visuales de las mesas añadidas */}
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Mesas seleccionadas:</p>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {virtualTableIds.split(/[\s,]+/).filter(Boolean).map(idStr => {
                    const id = parseInt(idStr, 10);
                    if (Number.isNaN(id)) return null;
                    const t = tables.find(tb => tb.tableNumber === id || tb.id === id);
                    if (!t) return (
                      <div key={idStr} className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm">
                        #{idStr} <span className="text-xs text-gray-500">(no encontrada)</span>
                      </div>
                    );
                    return (
                      <div key={t.id} className="px-3 py-2 bg-green-50 border-2 border-green-500 rounded-lg">
                        <div className="text-sm font-bold text-gray-900">#{t.tableNumber}</div>
                        <div className="text-xs text-gray-600">{t.zoneName}</div>
                        <div className="text-xs text-green-700 font-medium">En orden</div>
                      </div>
                    );
                  })}
                  {virtualTableIds.trim() === '' && (
                    <p className="text-sm text-gray-500 flex items-center justify-center w-full">Ninguna mesa seleccionada</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer fijo con botones */}
            <div className="p-6 pt-3 border-t border-gray-200 flex gap-2">
              <button 
                type="button"
                onClick={(e) => {
                  console.log('🔴 Cancelar clickeado');
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVirtualTableModal(false); 
                  setVirtualTableIds(''); 
                  setShowVirtualTableCamera(false); 
                }} 
                className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  console.log('🟢 Crear mesa virtual clickeado');
                  console.log('🟢 virtualTableIds:', virtualTableIds);
                  e.preventDefault();
                  e.stopPropagation();
                  createVirtualTable();
                }}
                disabled={virtualTableIds.split(/[\s,]+/).filter(Boolean).length < 2}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear mesa virtual ({virtualTableIds.split(/[\s,]+/).filter(Boolean).length} mesas)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Orden (Mis Mesas) */}
      {showMyOrderModal && myOrderModalOrder && (() => {
        const order = myOrderModalOrder;
        const orderId = getOrderId(order);
        const hasFoodItems = (order.items ?? []).some((i: any) => !isDrinkItem(i.dishName ?? i.DishName ?? ''));
        const hasDrinkItems = (order.items ?? []).some((i: any) => isDrinkItem(i.dishName ?? i.DishName ?? ''));
        const foodItems = (order.items ?? []).filter((i: any) => !isDrinkItem(i.dishName ?? i.DishName ?? ''));
        const drinkItems = (order.items ?? []).filter((i: any) => isDrinkItem(i.dishName ?? i.DishName ?? ''));
        const kitchenReady = (order as any).kitchenReady ?? (order as any).KitchenReady;
        const barReady = (order as any).barReady ?? (order as any).BarReady;
        const kitchenServed = (order as any).kitchenServed ?? (order as any).KitchenServed;
        const barServed = (order as any).barServed ?? (order as any).BarServed;
        const bothServed = (!hasFoodItems || kitchenServed) && (!hasDrinkItems || barServed);
        const allAllergies = [...new Set((order.items ?? []).map((i: any) => (i.allergies ?? i.Allergies ?? '').trim()).filter(Boolean))];

        const closeModal = () => { setShowMyOrderModal(false); setMyOrderModalOrder(null); };

        const doKitchenServed = async () => {
          try {
            const res = await api.put(`/api/order/${orderId}/kitchen-served`);
            toast.success('Comida servida ✓');
            setMyOrderModalOrder((prev: any) => prev ? { ...prev, ...(res.data ?? {}), kitchenServed: true, KitchenServed: true } : prev);
            loadData(getUserId(user));
          } catch (e: any) { toast.error(e?.response?.data?.error || 'Error al registrar'); }
        };

        const doBarServed = async () => {
          try {
            const res = await api.put(`/api/order/${orderId}/bar-served`);
            toast.success('Bebidas servidas ✓');
            setMyOrderModalOrder((prev: any) => prev ? { ...prev, ...(res.data ?? {}), barServed: true, BarServed: true } : prev);
            loadData(getUserId(user));
          } catch (e: any) { toast.error(e?.response?.data?.error || 'Error al registrar'); }
        };

        return (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={closeModal}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between p-4 border-b">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-bold">Mesa {order.tableNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getOrderStatusColor(order.status)}`}>{order.status}</span>
                  </div>
                  {(order as any).customerName && <p className="text-sm text-primary-600 font-medium">{(order as any).customerName}</p>}
                  <p className="text-xs text-gray-400 font-mono">{order.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">RD$ {((order as any).total ?? 0).toFixed(2)}</p>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 mt-1 text-xs">✕ Cerrar</button>
                </div>
              </div>

              {/* Alertas de alergias */}
              {allAllergies.length > 0 && (
                <div className="mx-4 mt-3 rounded-lg bg-red-50 border border-red-200 p-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-red-800 font-semibold text-sm uppercase">ALERGIA: {allAllergies.join(', ')}</span>
                </div>
              )}

              {/* Tabs Cocina / Bar */}
              {hasFoodItems && hasDrinkItems && (
                <div className="flex gap-1 mx-4 mt-3 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setMyOrderModalTab('kitchen')}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1 ${myOrderModalTab === 'kitchen' ? 'bg-white shadow text-orange-700' : 'text-gray-500'}`}
                  >
                    🍽 Cocina {kitchenServed ? '✓' : kitchenReady ? '(Listo)' : ''}
                  </button>
                  <button
                    onClick={() => setMyOrderModalTab('bar')}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1 ${myOrderModalTab === 'bar' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}
                  >
                    🍹 Bar {barServed ? '✓' : barReady ? '(Listo)' : ''}
                  </button>
                </div>
              )}

              {/* Contenido del tab activo */}
              <div className="p-4 space-y-2">
                {(() => {
                  const items = (!hasFoodItems || !hasDrinkItems)
                    ? (order.items ?? [])
                    : myOrderModalTab === 'kitchen' ? foodItems : drinkItems;

                  return items.map((item: any, idx: number) => (
                    <div key={idx} className="rounded-lg bg-gray-50 border p-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium"><span className="text-primary-600">{item.quantity}x</span> {item.dishName ?? item.DishName}</span>
                      </div>
                      {(item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking) && (
                        <div className="text-xs text-orange-600 mt-0.5">🔥 {item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking}</div>
                      )}
                      {(item.sideDish ?? item.SideDish) && <div className="text-xs text-gray-500 mt-0.5">Guarnición: {item.sideDish ?? item.SideDish}</div>}
                      {(item.notes ?? item.Notes) && <div className="text-xs text-gray-500 mt-0.5">Nota: {item.notes ?? item.Notes}</div>}
                      {(item.customizations ?? item.Customizations) && <div className="text-xs text-gray-500 mt-0.5">Personalización: {item.customizations ?? item.Customizations}</div>}
                    </div>
                  ));
                })()}
              </div>

              {/* Botones de acción del tab */}
              <div className="px-4 pb-2 space-y-2">
                {/* Servir Cocina */}
                {(!hasDrinkItems || myOrderModalTab === 'kitchen' || !hasFoodItems) && hasFoodItems && (
                  <button
                    disabled={!kitchenReady || kitchenServed}
                    onClick={doKitchenServed}
                    className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
                      kitchenServed ? 'bg-teal-100 text-teal-700 cursor-default'
                      : kitchenReady ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {kitchenServed ? '✓ Comida ya servida' : kitchenReady ? '🍽 Servir Comida' : '⏳ Cocina aún preparando...'}
                  </button>
                )}
                {/* Servir Bar */}
                {(!hasFoodItems || myOrderModalTab === 'bar' || !hasDrinkItems) && hasDrinkItems && (
                  <button
                    disabled={!barReady || barServed}
                    onClick={doBarServed}
                    className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
                      barServed ? 'bg-teal-100 text-teal-700 cursor-default'
                      : barReady ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {barServed ? '✓ Bebidas ya servidas' : barReady ? '🍹 Servir Bebidas' : '⏳ Bar aún preparando...'}
                  </button>
                )}
              </div>

              {/* Separador + Acciones generales */}
              <div className="px-4 pb-4 space-y-2 border-t pt-3 mt-1">
                {/* Quedarme con la mesa (se oculta si ya está reclamada) */}
                {['Pending','Confirmed','Preparing','Ready','Served'].includes(order.status) && !claimedTableIds.has((order as any).tableId ?? (order as any).TableId) && (
                  pendingClaimTableIds.has((order as any).tableId ?? (order as any).TableId) ? (
                    <div className="w-full py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-semibold flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 animate-pulse" />
                      Solicitud pendiente — esperando admin...
                    </div>
                  ) : (
                    <button
                      onClick={() => setClaimConfirmOrder(order)}
                      className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Quedarme con esta Mesa
                    </button>
                  )
                )}

                {/* Mover comensal */}
                {['Pending','Confirmed','Preparing','Ready'].includes(order.status) && (
                  <button
                    onClick={() => { closeModal(); setShowMoveModal({ order }); }}
                    className="w-full py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Mover comensal a otra mesa
                  </button>
                )}

                {/* Cobrar */}
                {(order.status === 'Served' || order.status === 'Completed') && !(order as Order).paymentCollectedByWaiter && (
                  <button
                    onClick={() => { closeModal(); setSelectedOrder(order); setShowPaymentModal(true); }}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                  >
                    Cobrar (recolectar pago del cliente)
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Solicitar Quedarme con Mesa (requiere aprobación del admin) */}
      {claimConfirmOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Pin className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Quedarme con Mesa {claimConfirmOrder.tableNumber}</h2>
                <p className="text-sm text-gray-500">El admin deberá aprobar tu solicitud.</p>
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 text-sm text-indigo-700">
              <strong>¿Cómo funciona?</strong><br />
              Al enviar la solicitud, el admin recibirá una notificación. Si aprueba, quedarás asignado a la mesa y recibirás confirmación aquí.
            </div>
            <p className="text-sm text-gray-600 mb-5">
              ¿Enviar solicitud para quedarte con la mesa <strong>#{claimConfirmOrder.tableNumber}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setClaimConfirmOrder(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const uid = getUserId(user);
                  const tableId = (claimConfirmOrder as any).tableId ?? (claimConfirmOrder as any).TableId;
                  if (!uid || !tableId) return;
                  try {
                    await api.post('/api/tableclaim', {
                      waiterId: uid,
                      tableId,
                      orderId: getOrderId(claimConfirmOrder) || null,
                    });
                    // Marcar como pendiente localmente
                    setPendingClaimTableIds(prev => new Set(prev).add(tableId));
                    toast(`⏳ Solicitud enviada al admin. Espera su respuesta.`, {
                      duration: 7000,
                      style: { background: '#eef2ff', color: '#4338ca', fontWeight: 600 }
                    });
                    setClaimConfirmOrder(null);
                  } catch (err: any) {
                    toast.error(err?.response?.data?.error || 'Error al enviar la solicitud');
                  }
                }}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Pin className="w-4 h-4" />
                Solicitar mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Soltar asignación (pin) */}
      {abandonConfirmOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <PinOff className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Soltar Mesa {abandonConfirmOrder.tableNumber}</h2>
                <p className="text-sm text-gray-500">Los pedidos nuevos de esta mesa ya no te llegarán a ti.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              El pedido actual de la mesa <strong>#{abandonConfirmOrder.tableNumber}</strong> sigue siendo tuyo hasta que termine. Solo los <strong>próximos pedidos</strong> de esa mesa no se asignarán a ti.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAbandonConfirmOrder(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const oid = getOrderId(abandonConfirmOrder);
                  const tableId = (abandonConfirmOrder as any).tableId ?? (abandonConfirmOrder as any).TableId;
                  try {
                    await api.put(`/api/order/${oid}/unassign-waiter`);
                    toast.success(`Ya no estás asignado a Mesa ${abandonConfirmOrder.tableNumber}`);
                    setClaimedTableIds(prev => { const s = new Set(prev); s.delete(tableId); return s; });
                    setAbandonConfirmOrder(null);
                  } catch (err: any) {
                    toast.error(err?.response?.data?.error || 'Error al soltar la mesa');
                  }
                }}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm"
              >
                Sí, soltar mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mover comensal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Mover comensal a otra mesa</h2>
            <p className="text-sm text-gray-600 mb-4">Orden {showMoveModal.order.orderNumber} · Mesa actual: {showMoveModal.order.tableNumber}</p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mesa destino</label>
            <select
              value={moveTargetTableId ?? ''}
              onChange={e => setMoveTargetTableId(parseInt(e.target.value, 10) || null)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
            >
              <option value="">Seleccionar...</option>
              {tables
                .filter(t => t.id !== (showMoveModal.order.tableId ?? (showMoveModal.order as any).TableId))
                .map(t => (
                  <option key={t.id} value={t.id}>Mesa {t.tableNumber} - {t.zoneName}</option>
                ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => { setShowMoveModal(null); setMoveTargetTableId(null); }} className="flex-1 py-2 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={moveOrderToTable} disabled={!moveTargetTableId} className="flex-1 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">Mover</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferir mesas */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Transferir mesas</h2>
            <p className="text-sm text-gray-600 mb-4">Selecciona las mesas a transferir y el mesero destino. Él deberá aceptar.</p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mesas (mis mesas asignadas)</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {myOrders
                .reduce((acc: number[], o) => {
                  const tid = (o as any).tableId ?? (o as any).TableId;
                  if (tid && !acc.includes(tid)) acc.push(tid);
                  return acc;
                }, [])
                .map(tableId => {
                  const t = tables.find(tb => tb.id === tableId);
                  const selected = transferTableIds.includes(tableId);
                  return (
                    <button
                      key={tableId}
                      type="button"
                      onClick={() => setTransferTableIds(prev => selected ? prev.filter(id => id !== tableId) : [...prev, tableId])}
                      className={`px-3 py-1 rounded-lg border ${selected ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300'}`}
                    >
                      Mesa {t?.tableNumber ?? tableId}
                    </button>
                  );
                })}
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transferir a</label>
            <select
              value={transferToWaiterId ?? ''}
              onChange={e => setTransferToWaiterId(parseInt(e.target.value, 10) || null)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
            >
              <option value="">Seleccionar mesero...</option>
              {waiterList.map(w => (
                <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => { setShowTransferModal(false); setTransferTableIds([]); setTransferToWaiterId(null); }} className="flex-1 py-2 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={sendTransfer} disabled={transferTableIds.length === 0 || !transferToWaiterId} className="flex-1 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-50">Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pedido manual (para mesa identificada) */}
      {showManualOrderModal && manualOrderTableId != null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Hacer pedido manual</h2>
            <p className="text-sm text-gray-600 mb-4">Mesa {tables.find(t => t.id === manualOrderTableId)?.tableNumber ?? manualOrderTableId}</p>
            <ManualOrderForm
              tableId={manualOrderTableId}
              dishes={dishesForManual}
              onClose={() => { setShowManualOrderModal(false); setManualOrderTableId(null); setDishesForManual([]); }}
              onSuccess={() => {
                setShowManualOrderModal(false);
                setManualOrderTableId(null);
                setDishesForManual([]);
                loadData(getUserId(user!));
                toast.success('Pedido creado');
              }}
              api={api}
            />
          </div>
        </div>
      )}

      {/* Modal de detalles de mesa virtual */}
      {showVirtualTableDetailsModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header fijo */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-purple-900">
                {showVirtualTableDetailsModal?.name ?? showVirtualTableDetailsModal?.Name ?? 'Mesa Virtual'}
              </h2>
              <p className="text-sm text-purple-700">
                {(() => {
                  const vtTables = Array.isArray(showVirtualTableDetailsModal?.tables) 
                    ? showVirtualTableDetailsModal.tables 
                    : (Array.isArray(showVirtualTableDetailsModal?.Tables) ? showVirtualTableDetailsModal.Tables : []);
                  return `${vtTables.length} mesas unidas`;
                })()}
              </p>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const vtTables = Array.isArray(showVirtualTableDetailsModal?.tables) 
                  ? showVirtualTableDetailsModal.tables 
                  : (Array.isArray(showVirtualTableDetailsModal?.Tables) ? showVirtualTableDetailsModal.Tables : []);
                
                if (vtTables.length === 0) {
                  return <div className="p-6 text-center text-gray-500">No hay mesas en esta mesa virtual</div>;
                }

                const currentTable = vtTables[selectedVTTableIndex] || vtTables[0];
                const currentTableId = currentTable?.id ?? currentTable?.Id;
                const currentTableNumber = currentTable?.tableNumber ?? currentTable?.TableNumber ?? '?';
                const currentTableZone = currentTable?.zoneName ?? currentTable?.ZoneName ?? 'Sin zona';

                const vtTableIds = vtTables.map((t: any) => t?.id ?? t?.Id);
                
                // Incluir tanto órdenes asignadas como no asignadas de las mesas virtuales
                const vtOrders = [
                  ...myOrders.filter(o => {
                    const tId = (o as any).tableId ?? (o as any).TableId;
                    return vtTableIds.includes(tId);
                  }),
                  ...generalOrders.filter(o => {
                    const tId = (o as any).tableId ?? (o as any).TableId;
                    return vtTableIds.includes(tId);
                  })
                ];

                const currentTableOrders = vtOrders.filter(o => 
                  (o as any).tableId === currentTableId || (o as any).TableId === currentTableId
                );

                const totalVT = vtOrders.reduce((sum, o) => sum + ((o as any).total ?? (o as any).totalAmount ?? 0), 0);

                return (
                  <div className="flex flex-col h-full">
                    {/* Navegación de mesas */}
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {vtTables.map((t: any, idx: number) => {
                          const tId = t?.id ?? t?.Id;
                          const tNumber = t?.tableNumber ?? t?.TableNumber ?? '?';
                          const tOrders = vtOrders.filter(o => (o as any).tableId === tId || (o as any).TableId === tId);
                          const isSelected = idx === selectedVTTableIndex;
                          
                          return (
                            <button
                              key={tId}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedVTTableIndex(idx);
                              }}
                              className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all ${
                                isSelected 
                                  ? 'bg-purple-600 text-white border-purple-600' 
                                  : 'bg-white text-purple-900 border-purple-300 hover:border-purple-500'
                              }`}
                            >
                              <div className="font-bold">Mesa #{tNumber}</div>
                              <div className="text-xs">{tOrders.length} orden(es)</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Contenido de la mesa seleccionada */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-purple-900">Mesa #{currentTableNumber}</h3>
                        <p className="text-sm text-purple-700">{currentTableZone}</p>
                      </div>

                      {currentTableOrders.length > 0 ? (
                        <div className="space-y-3">
                          {currentTableOrders.map((order) => (
                              <div key={getOrderId(order)} className="bg-white rounded-lg border-2 border-purple-200 p-4 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-lg text-gray-900">{order.orderNumber}</span>
                                  {(order.items ?? []).some((i: any) => (i.allergies ?? i.Allergies ?? '').trim()) && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5" /> ALERGIA
                                    </span>
                                  )}
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                                  {order.status}
                                </span>
                              </div>
                              {(order as any).customerName && (
                                <div className="text-sm text-primary-700 font-medium mb-1">{(order as any).customerName}</div>
                              )}
                              <div className="text-xs text-gray-500 mb-3">
                                {new Date(order.createdAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                              </div>

                              {/* Bloque alergias */}
                              {(() => {
                                const allAllergies = (order.items ?? []).map((i: any) => (i.allergies ?? i.Allergies ?? '').trim()).filter(Boolean);
                                const uniq = [...new Set(allAllergies)];
                                if (uniq.length === 0) return null;
                                return (
                                  <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                    <span className="text-red-800 font-semibold text-sm uppercase">{uniq.join(', ')}</span>
                                  </div>
                                );
                              })()}
                              
                              <div className="space-y-2 mb-3">
                                {order.items?.map((item: any, idx: number) => (
                                  <div key={idx} className="text-sm rounded-lg bg-amber-50/50 border border-amber-200/60 p-2">
                                    <div className="flex justify-between">
                                      <span className="text-gray-800 font-medium"><span className="font-semibold text-purple-900">{item.quantity}x</span> {item.dishName ?? item.DishName}</span>
                                    </div>
                                    {(item.notes ?? item.Notes ?? item.customizations ?? item.Customizations ?? item.allergies ?? item.Allergies ?? item.sideDish ?? item.SideDish ?? item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking) && (
                                      <div className="mt-1.5 text-xs text-gray-600 space-y-0.5 pl-1 border-l-2 border-amber-300">
                                        {(item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking) ? <div>🔥 Preferencia / Término: {item.preferenceText ?? item.PreferenceText ?? item.meatCooking ?? item.MeatCooking}</div> : null}
                                        {item.sideDish ?? item.SideDish ? <div>Guarnición: {item.sideDish ?? item.SideDish}</div> : null}
                                        {item.notes ?? item.Notes ? <div>Notas: {item.notes ?? item.Notes}</div> : null}
                                        {item.customizations ?? item.Customizations ? <div>Personalización: {item.customizations ?? item.Customizations}</div> : null}
                                        {item.allergies ?? item.Allergies ? <div className="text-red-700 font-medium">⚠ Alergia: {item.allergies ?? item.Allergies}</div> : null}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              
                              <div className="flex justify-between items-center pt-3 border-t-2 border-purple-200">
                                <span className="font-bold text-gray-700">Total:</span>
                                <span className="text-xl font-bold text-purple-900">
                                  RD$ {((order as any).total ?? (order as any).totalAmount ?? 0).toFixed(2)}
                                </span>
                              </div>

                              {/* Mismo flujo que mesa individual: por orden */}
                              <div className="flex flex-col gap-2 mt-3 pt-3 border-t-2 border-purple-100">
                                {(order as any).status === 'Pending' && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmOrder(order).then(ok => { if (ok && user) { loadData(getUserId(user)); loadVirtualTables(); } }); }}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                  >
                                    Confirmar (enviar a cocina/bar)
                                  </button>
                                )}
                                {['Pending','Confirmed','Preparing','Ready'].includes((order as any).status) && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMoveModal({ order }); setShowVirtualTableDetailsModal(null); }}
                                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center gap-2"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Mover comensal a otra mesa
                                  </button>
                                )}
                                {(order as any).status === 'Ready' && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsServed(getOrderId(order)); }}
                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                  >
                                    Marcar como Servida
                                  </button>
                                )}
                                {((order as any).status === 'Served' || (order as any).status === 'Completed') && (
                                  <>
                                    {!(order as any).paymentCollectedByWaiter && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedOrder(order); setShowPaymentModal(true); setShowVirtualTableDetailsModal(null); }}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                      >
                                        Cobrar (recolectar pago del cliente)
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); releaseTable((order as any).tableId ?? (order as any).TableId); setShowVirtualTableDetailsModal(null); }}
                                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                    >
                                      Liberar mesa
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                          <div className="text-4xl mb-2">📋</div>
                          <div>No hay órdenes activas en esta mesa</div>
                        </div>
                      )}

                      {/* Marcar toda la mesa como servida (solo si hay órdenes Ready en esta mesa) */}
                      {currentTableOrders.some((o: any) => o.status === 'Ready') && (
                        <div className="mt-4 px-6">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); markTableAsServed(currentTableOrders); }}
                            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                          >
                            Marcar toda la Mesa #{currentTableNumber} como servida
                          </button>
                        </div>
                      )}

                    </div>

                    {/* Total general de la mesa virtual */}
                    <div className="px-6 py-4 border-t-2 border-purple-300 bg-purple-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs text-purple-700">Total Mesa Virtual</div>
                          <div className="text-sm text-purple-800">{vtOrders.length} orden(es) · {vtTables.length} mesa(s)</div>
                        </div>
                        <span className="text-2xl font-bold text-purple-900">
                          RD$ {totalVT.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer fijo */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVirtualTableDetailsModal(null);
                }}
                className="flex-1 py-2 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400"
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

function ManualOrderForm({
  tableId,
  dishes,
  onClose,
  onSuccess,
  api
}: {
  tableId: number;
  dishes: any[];
  onClose: () => void;
  onSuccess: () => void;
  api: any;
}) {
  const [selected, setSelected] = useState<{ dishId: number; name: string; price: number; quantity: number }[]>([]);
  const add = (d: any) => {
    const id = d.id ?? d.Id;
    const name = d.name ?? d.Name ?? '';
    const price = Number(d.price ?? d.Price ?? 0);
    const existing = selected.find(s => s.dishId === id);
    if (existing) existing.quantity++;
    else setSelected([...selected, { dishId: id, name, price, quantity: 1 }]);
  };
  const decrement = (dishId: number) => {
    const s = selected.find(x => x.dishId === dishId);
    if (!s) return;
    if (s.quantity <= 1) setSelected(selected.filter(x => x.dishId !== dishId));
    else setSelected(selected.map(x => x.dishId === dishId ? { ...x, quantity: x.quantity - 1 } : x));
  };
  const subtotal = selected.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      await api.post('/api/order', {
        tableId,
        sessionId: `manual-${Date.now()}`,
        items: selected.map(s => ({ dishId: s.dishId, quantity: s.quantity, unitPrice: s.price }))
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al crear pedido');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <>
      <div className="mb-4 max-h-48 overflow-y-auto border rounded-lg p-2">
        {dishes.map(d => (
          <div key={d.id ?? d.Id} className="flex justify-between items-center py-2 border-b last:border-0">
            <span className="text-sm">{d.name ?? d.Name} - RD$ {Number(d.price ?? d.Price ?? 0).toFixed(2)}</span>
            <button type="button" onClick={() => add(d)} className="text-green-600 font-medium">+</button>
          </div>
        ))}
      </div>
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Pedido:</p>
        {selected.map(s => (
          <div key={s.dishId} className="flex justify-between items-center py-1">
            <span>{s.quantity}x {s.name}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => decrement(s.dishId)} className="text-gray-500">−</button>
              <span>RD$ {(s.price * s.quantity).toFixed(2)}</span>
            </div>
          </div>
        ))}
        {selected.length === 0 && <p className="text-gray-500 text-sm">Añade platos arriba</p>}
      </div>
      <p className="text-right font-bold mb-4">Total: RD$ {total.toFixed(2)}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg">Cancelar</button>
        <button type="button" onClick={submit} disabled={selected.length === 0 || submitting} className="flex-1 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
          {submitting ? 'Creando...' : 'Crear pedido'}
        </button>
      </div>
    </>
  );
}
