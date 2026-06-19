'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Utensils, Clock, DollarSign, CheckCircle, AlertCircle, XCircle, LogOut, Wine, Check, RefreshCw, QrCode, Users, ArrowRightLeft, Share2, Pin, PinOff, Bell, X, ChefHat, Play, Square, Phone, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Plus, Minus, Pencil } from 'lucide-react';
// Icono de exclamación para alarma en mesas con pedido sin asignar
const AlertExclamation = () => (
  <span className="inline-flex items-center justify-center text-red-600 font-bold text-xl animate-pulse" style={{ animationDuration: '0.8s' }}>!</span>
);
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useWaiterNotifications, WaiterNotification } from '@/lib/useWaiterNotifications';
import { useWaiterFloorPlan } from '@/lib/useWaiterFloorPlan';

// Carga dinámica del QrScanner para evitar chunk errors en HTTPS
const QrScanner = dynamic(() => import('./components/QrScanner').then(mod => ({ default: mod.QrScanner })), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-600 animate-pulse">Cargando cámara...</p>
});

// Plano de salón (react-konva) en SOLO LECTURA — ssr:false porque Konva necesita el DOM.
const MultiZoneFloorPlanViewer = dynamic(
  () => import('@smartmenu/ui').then((m) => ({ default: m.MultiZoneFloorPlanViewer })),
  { ssr: false, loading: () => <p className="p-6 text-sm text-gray-500 animate-pulse">Cargando plano...</p> }
);

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
    customerName?: string; // comensal que pidió este ítem (varios comensales por mesa)
  }>;
}

// Bartender: mismo login que waiter pero ve KDS de bebidas
const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  return DRINK_KEYWORDS.some(k => name.includes(k));
}
// Código de pedido corto y legible para el mesero: ORD-20260611144054-7cfdfa → "7CFDFA"
const shortOrder = (on?: string | null) => ((on ?? '').split('-').pop() ?? '').toUpperCase();
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

// Estilo del banner por tipo de notificación — para renderizar el aviso del bell también en la tarjeta de Mis Mesas.
// Cualquier tipo no listado igual se muestra con NOTIF_CARD_DEFAULT (todas las notificaciones aparecen en la tarjeta).
const NOTIF_CARD_DEFAULT = { cls: 'bg-slate-100 text-slate-700 border-slate-300', icon: '🔔' };
const NOTIF_CARD: Record<string, { cls: string; icon: string; pulse?: boolean }> = {
  kitchen_ready:     { cls: 'bg-green-100 text-green-800 border-green-300', icon: '🍽' },
  bar_ready:         { cls: 'bg-green-100 text-green-800 border-green-300', icon: '🍹' },
  customer_finished: { cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: '🔔', pulse: true },
  items_added:       { cls: 'bg-blue-100 text-blue-800 border-blue-300', icon: '➕' },
  billing_requested: { cls: 'bg-red-100 text-red-800 border-red-300', icon: '💳', pulse: true },
  claim_approved:    { cls: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: '✅' },
  claim_rejected:    { cls: 'bg-rose-100 text-rose-800 border-rose-300', icon: '🚫' },
};

// Reloj digital LCD 7-segment estilo radio-despertador
function DigitalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  // Formato 12h con indicador AM/PM al lado (estilo radio-despertador)
  const hours24 = now.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const period = hours24 < 12 ? 'AM' : 'PM';
  const h = String(hours12).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const time = `${h}:${m}:${s}`;
  const date = now.toLocaleDateString('es-DO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 bg-black rounded-lg border border-zinc-800 shadow-inner min-w-[150px] relative">
      <div className="flex items-baseline gap-1.5 relative">
        {/* Ghost de los 8s detrás para imitar el LCD apagado */}
        <span className="font-7seg text-xl text-white/[0.04] leading-none absolute select-none pointer-events-none" aria-hidden>
          88:88:88
        </span>
        <span className="font-7seg text-xl text-white clock-glow leading-none relative">
          {time}
        </span>
        {/* Indicador AM/PM al lado, vertical para imitar relojes despertadores */}
        <span
          className={`font-mono text-[9px] font-bold leading-none tracking-wider ml-0.5 relative ${
            period === 'AM' ? 'text-amber-300' : 'text-orange-400'
          }`}
        >
          {period}
        </span>
      </div>
      <span className="font-mono text-[9px] text-zinc-400 leading-tight mt-1 uppercase tracking-widest">
        {date}
      </span>
    </div>
  );
}

function getUserId(u: any): number {
  const id = u?.id ?? u?.Id ?? u?.ID;
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
  // Guard de hidratación: la página es auth-gated (SSR sin token → render vacío). Mostramos el
  // loader hasta montar en el cliente para evitar el mismatch (#418) que la dejaba en blanco al recargar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [view, setView] = useState<'general' | 'my-tables' | 'plano'>('general');
  const { data: floorPlanData, palette: floorPlanPalette } = useWaiterFloorPlan();
  const [planoSel, setPlanoSel] = useState<string | number | null>(null);
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
  // WAITER-QR.1 — verificación de mesa desde modal de orden:
  //   - tableId: mesa esperada (de la orden)
  //   - tableNumber: número visible al usuario para mostrar en el modal
  const [qrVerifyContext, setQrVerifyContext] = useState<{ tableId: number; tableNumber: number | string } | null>(null);
  // QR-MESA-DIRECT.1: mini-modal de confirmación al tap directo en mesa disponible
  const [confirmIdentifyTable, setConfirmIdentifyTable] = useState<{ id: number; tableNumber: number; zoneName: string } | null>(null);
  const [qrTableInput, setQrTableInput] = useState('');
  const [showQrCamera, setShowQrCamera] = useState(false);
  const [showVirtualTableCamera, setShowVirtualTableCamera] = useState(false);
  const [showVirtualTableModal, setShowVirtualTableModal] = useState(false);
  const [virtualTableIds, setVirtualTableIds] = useState<string>('');
  const [showMoveModal, setShowMoveModal] = useState<{ order: Order } | null>(null);
  const [moveTargetTableId, setMoveTargetTableId] = useState<number | null>(null);
  // TAREA 5: transferencia de mesas por MULTI-SELECCIÓN con checks (reemplaza el modal anterior).
  // `transferMode` = botón "TRANSFERIR MESAS" hundido/activo; mientras está activo, el click
  // normal sobre una mesa queda SUSPENDIDO y en su lugar marca/desmarca la mesa.
  const [transferMode, setTransferMode] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<number>>(new Set());
  const [transferToWaiterId, setTransferToWaiterId] = useState<number | null>(null);
  const [sendingTransfer, setSendingTransfer] = useState(false);
  const [waiterList, setWaiterList] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  // CHANGE-TABLE.2: "Cambiar de mesa" eliminado — funcionalidad redundante.
  // El flujo "Mover comensal a otra mesa" en el modal de cada orden ya cubre el mismo caso.
  const [showManualOrderModal, setShowManualOrderModal] = useState(false);
  const [manualOrderTableId, setManualOrderTableId] = useState<number | null>(null);
  const [dishesForManual, setDishesForManual] = useState<any[]>([]);
  const [virtualTablesList, setVirtualTablesList] = useState<any[]>([]);
  const [showVirtualTableDetailsModal, setShowVirtualTableDetailsModal] = useState<any>(null);
  // VT-PAY — mesa pagadora (al crear) + cobro unificado de mesa virtual
  const [vtPayerTableId, setVtPayerTableId] = useState<number | null>(null);
  const [showVtPayModal, setShowVtPayModal] = useState<{ vt: any; total: number; orderCount: number } | null>(null);
  const [vtPayMethod, setVtPayMethod] = useState<string>('Cash');
  const [vtPaying, setVtPaying] = useState(false);
  const [showMyOrderModal, setShowMyOrderModal] = useState(false);
  // RES-DETAIL.3: Modal de detalles de reserva cuando waiter toca una mesa Reserved
  interface ReservedTableInfo {
    id: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    numberOfGuests: number;
    reservationDateTime: string;
    reservedUntil?: string;
    specialRequests?: string;
    tableNumber: number;
    zoneName: string;
    // PARTE A: nombre del host (empleado) que aceptó la reserva
    createdByHostName?: string | null;
    preOrder?: { items: Array<{ dishName: string; quantity: number; notes?: string }> } | null;
  }
  const [reservedInfo, setReservedInfo] = useState<ReservedTableInfo | null>(null);
  const [loadingReservation, setLoadingReservation] = useState(false);

  // TAREA 4: filtro waiter de UN SOLO DÍA (default = hoy) con mini-calendario.
  // Reemplaza el antiguo rango DESDE→HASTA: ahora se marca como Reservada cualquier mesa
  // con una reserva confirmada cuyo día coincida con `selectedDay`.
  const todayKey = new Date().toLocaleDateString('sv-SE');
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [dpMonth, setDpMonth] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reservedTableIdsInRange, setReservedTableIdsInRange] = useState<Set<number>>(new Set());

  // Carga las reservas y computa el set de tableIds reservados ese día
  useEffect(() => {
    if (!selectedDay) {
      setReservedTableIdsInRange(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/tablereservation');
        const list: any[] = Array.isArray(res.data) ? res.data : [];
        const ids = new Set<number>();
        list.forEach((r: any) => {
          if (r.isCancelled) return;
          if (!r.isConfirmed) return; // Solo cuenta reservas YA aceptadas por el host
          if (!r.tableId) return;
          // TAREA 4: igualdad de día (no rango)
          if (new Date(r.reservationDateTime).toLocaleDateString('sv-SE') === selectedDay) ids.add(r.tableId);
        });
        if (!cancelled) setReservedTableIdsInRange(ids);
      } catch {
        if (!cancelled) setReservedTableIdsInRange(new Set());
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDay]);
  const [myOrderModalOrder, setMyOrderModalOrder] = useState<Order | null>(null);
  const [myOrderModalTab, setMyOrderModalTab] = useState<'kitchen' | 'bar'>('kitchen');
  const [abandonConfirmOrder, setAbandonConfirmOrder] = useState<Order | null>(null);
  // CLAIM-MODAL.1: estado del modal eliminado — el botón "Quedarme con esta Mesa" envía la solicitud directamente.
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
  const { notifications, unreadCount, connected, markAllRead, markRead, dismiss, clearAll } = useWaiterNotifications({
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
    customerFinished: Set<number>; // orderIds ya notificados (cliente terminó de comer)
    initialized:  boolean;
  }>({ kitchenReady: new Set(), barReady: new Set(), billing: new Set(), customerFinished: new Set(), initialized: false });

  useEffect(() => {
    const allOrders = [...myOrders, ...generalOrders];

    if (!notifStateRef.current.initialized) {
      // Primera carga: registrar estado actual como línea base (no notificar)
      notifStateRef.current.initialized = true;
      for (const o of allOrders) {
        const oid: number = (o as any).id;
        if ((o as any).kitchenReady || (o as any).KitchenReady) notifStateRef.current.kitchenReady.add(oid);
        if ((o as any).barReady    || (o as any).BarReady)    notifStateRef.current.barReady.add(oid);
        if ((o as any).customerFinishedEating || (o as any).CustomerFinishedEating) notifStateRef.current.customerFinished.add(oid);
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
      // Cliente terminó de comer — notificar SOLO al mesero que atiende esa orden.
      // (Respaldo por polling: customer_finished es solo-SignalR y puede no llegar por el proxy.)
      const cf = !!((o as any).customerFinishedEating || (o as any).CustomerFinishedEating);
      const assignedTo = (o as any).assignedWaiterId ?? (o as any).AssignedWaiterId ?? null;
      if (cf && assignedTo === waiterId && !notifStateRef.current.customerFinished.has(oid)) {
        notifStateRef.current.customerFinished.add(oid);
        toast(`✅ Mesa ${tn} terminó de comer`, {
          duration: 9000, style: { background: '#f0fdf4', color: '#166534', fontWeight: 700 }
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
    if (virtualTablesList.length > 0) {
    }
  }, [virtualTablesList]);
  
  // Ref para el intervalo de polling (no causa re-renders)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldPollRef = useRef(true);

  // Callbacks memoizados para QrScanner (evita re-crear funciones y desmontar el componente)
  const handleQrScanIdentify = useCallback(async (tableIdOrQrCode: number | string) => {
    // Si es número, buscar por número de mesa o ID
    if (typeof tableIdOrQrCode === 'number') {
      const t = tables.find(tb => tb.tableNumber === tableIdOrQrCode || tb.id === tableIdOrQrCode);
      if (t) {
        setIdentifiedTableId(t.id);
        toast.success(`Mesa ${t.tableNumber} identificada`);
      } else {
        setIdentifiedTableId(tableIdOrQrCode);
        toast.success('Mesa identificada por ID');
      }
    } else {
      // Es un GUID, buscar mesa por qrCode
      try {
        const token = localStorage.getItem('waiter_token');
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        const response = await api.get(`/api/table/qr/${tableIdOrQrCode}`);
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

  // WAITER-QR.1 — callback para verificar que el QR escaneado coincide con la mesa esperada (la de la orden)
  const handleQrVerifyTable = useCallback(async (tableIdOrQrCode: number | string) => {
    if (!qrVerifyContext) return;
    let scannedTableId: number | null = null;

    if (typeof tableIdOrQrCode === 'number') {
      // Si es número, ya es tableNumber o tableId
      const t = tables.find(tb => tb.tableNumber === tableIdOrQrCode || tb.id === tableIdOrQrCode);
      scannedTableId = t?.id ?? tableIdOrQrCode;
    } else {
      // Es GUID, resolver a tableId vía API
      try {
        const token = localStorage.getItem('waiter_token');
        if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get(`/api/table/qr/${tableIdOrQrCode}`);
        const table = response.data;
        if (table?.id) scannedTableId = table.id;
      } catch {
        toast.error('Error al leer el QR. Intenta de nuevo.');
        return;
      }
    }

    if (scannedTableId == null) {
      toast.error('QR no reconocido');
      return;
    }

    if (scannedTableId === qrVerifyContext.tableId) {
      toast.success(`Mesa ${qrVerifyContext.tableNumber} verificada correctamente`, { duration: 4000 });
    } else {
      const scannedNumber = tables.find(t => t.id === scannedTableId)?.tableNumber ?? scannedTableId;
      toast.error(`Mesa incorrecta. Escaneaste Mesa ${scannedNumber} pero esta orden es de Mesa ${qrVerifyContext.tableNumber}`, { duration: 6000 });
    }
    setQrVerifyContext(null);
  }, [qrVerifyContext, tables]);

  const handleQrScanVirtual = useCallback(async (tableIdOrQrCode: number | string) => {
    let tableNumber: number;
    
    // Si es número, usar directamente
    if (typeof tableIdOrQrCode === 'number') {
      tableNumber = tableIdOrQrCode;
    } else {
      // Es un GUID, buscar mesa por qrCode
      try {
        const token = localStorage.getItem('waiter_token');
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        const response = await api.get(`/api/table/qr/${tableIdOrQrCode}`);
        const table = response.data;
        if (table && table.tableNumber) {
          tableNumber = table.tableNumber;
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
    const hasModal = showPaymentModal || showOrderModal || showQrModal || showVirtualTableModal || showMoveModal || showManualOrderModal || showMyOrderModal;
    if (hasModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPaymentModal, showOrderModal, showQrModal, showVirtualTableModal, showMoveModal, showManualOrderModal, showMyOrderModal]);

  // Bloquear scroll del body cuando hay modales abiertos
  useEffect(() => {
    const isModalOpen = showQrModal || showVirtualTableModal || showPaymentModal || showOrderModal || showMoveModal || showManualOrderModal;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showQrModal, showVirtualTableModal, showPaymentModal, showOrderModal, showMoveModal, showManualOrderModal]);

  // TAREA 5: el modo transferencia sólo aplica en "Mis Mesas"; salir de esa vista lo cancela.
  useEffect(() => {
    if (view !== 'my-tables' && transferMode) exitTransferMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

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
        const { data: currentUser } = await api.get('/api/auth/me');
        
        if (currentUser && (currentUser.id != null || currentUser.Id != null)) {
          resolvedUser = currentUser;
          setUser(currentUser);
          localStorage.setItem('waiter_user', JSON.stringify(currentUser));
        } else {
          const userData = localStorage.getItem('waiter_user');
          if (!userData) {
            window.location.href = '/login';
            return;
          }
          resolvedUser = JSON.parse(userData);
          setUser(resolvedUser);
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
          return; // Pausar si la cámara está abierta
        }
        const u = JSON.parse(localStorage.getItem('waiter_user') || '{}');
        const id = getUserId(u);
        if (id) {
          loadData(id);
            loadVirtualTables();
          } else {
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

  // RES-DETAIL.3: cargar la reserva próxima/activa de una mesa Reserved
  async function openReservedTableInfo(tableId: number) {
    setLoadingReservation(true);
    setReservedInfo(null);
    try {
      const res = await api.get('/api/tablereservation');
      const list: any[] = Array.isArray(res.data) ? res.data : [];
      const now = Date.now();
      // Buscar la reserva confirmada más próxima (futura o reciente) para esta mesa
      const candidate = list
        .filter(r => r.tableId === tableId)
        .filter(r => !r.isCancelled && r.isConfirmed) // Solo reservas YA aceptadas por el host
        .map(r => ({ ...r, _ts: new Date(r.reservationDateTime).getTime() }))
        .filter(r => r._ts > now - 4 * 3600000) // descarta reservas viejas (4h)
        .sort((a, b) => Math.abs(a._ts - now) - Math.abs(b._ts - now))[0];
      if (!candidate) {
        toast.error('No se encontró reserva activa para esta mesa');
        return;
      }
      setReservedInfo(candidate as ReservedTableInfo);
    } catch {
      toast.error('Error cargando datos de la reserva');
    } finally {
      setLoadingReservation(false);
    }
  }

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
      return;
    }
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) {
        return;
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get(`/api/virtualtable/waiter/${uid}`);
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0) {
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
    
    // NOTA: Antes se bloqueaban las mesas ocupadas. Ahora SÍ se permite unir mesas
    // con cliente/orden activa — el backend conserva y unifica sus órdenes en la
    // vista de la mesa virtual. Se mantiene el resto de validaciones (mín 2, etc.).

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
        tableIds: tableIdList,
        payerTableId: vtPayerTableId ?? tableIdList[0],
      };
      
      const response = await api.post('/api/virtualtable', payload);
      
      toast.success(`Mesa virtual creada: ${virtualTableName}`);
      
      // Cerrar modal y limpiar
      setShowVirtualTableModal(false);
      setVirtualTableIds('');
      setShowVirtualTableCamera(false);
      
      // Delay para asegurar que el backend terminó de guardar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Forzar re-fetch con timestamp para evitar cache
      const timestamp = Date.now();
      api.defaults.headers.common['X-Refresh'] = timestamp.toString();
      
      // Recargar en orden específico
      await loadData(uid);
      
      await loadVirtualTables();
      
      // Esperar un tick para que React procese los cambios de estado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Cambiar a vista "Mis Mesas" DESPUÉS de cargar todo
      setView('my-tables');
      
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

  // VT-PAY — abrir modal de cobro unificado (calcula el total del grupo)
  const openVtPay = async (vt: any) => {
    const vtId = vt?.id ?? vt?.Id;
    if (!vtId) return;
    try {
      const token = localStorage.getItem('waiter_token');
      const res = await api.get(`/api/virtualtable/${vtId}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const orders = Array.isArray(res.data) ? res.data : [];
      const total = orders.reduce((s: number, o: any) => s + (o.total ?? o.Total ?? 0), 0);
      setVtPayMethod('Cash');
      setShowVtPayModal({ vt, total, orderCount: orders.length });
    } catch {
      setVtPayMethod('Cash');
      setShowVtPayModal({ vt, total: 0, orderCount: 0 });
    }
  };

  const payVirtualTable = async () => {
    const vt = showVtPayModal?.vt;
    const vtId = vt?.id ?? vt?.Id;
    if (!vtId) return;
    setVtPaying(true);
    try {
      const token = localStorage.getItem('waiter_token');
      const uid = getUserId(user);
      const res = await api.post(`/api/virtualtable/${vtId}/pay`, {
        paymentMethod: vtPayMethod,
        processedByWaiterId: uid,
        requiresFiscalReceipt: false,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Mesa virtual cobrada — RD$ ${Number(res.data?.total ?? 0).toFixed(2)} (${res.data?.ordersPaid ?? 0} órdenes)`, { duration: 6000 });
      setShowVtPayModal(null);
      setShowVirtualTableDetailsModal(null);
      await loadVirtualTables();
      if (uid) await loadData(uid);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al cobrar la mesa virtual');
    } finally {
      setVtPaying(false);
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

  // CHANGE-TABLE.2: funciones eliminadas — se usa "Mover comensal a otra mesa" del modal de orden.

  // TAREA 5 — Modo transferencia (multi-selección con checks) ────────────────
  // Entrar/salir del modo. Al entrar cargamos la lista de meseros destino.
  const enterTransferMode = () => {
    setTransferMode(true);
    setSelectedTableIds(new Set());
    setTransferToWaiterId(null);
    loadWaiters();
    loadPendingTransfers();
  };
  const exitTransferMode = () => {
    setTransferMode(false);
    setSelectedTableIds(new Set());
    setTransferToWaiterId(null);
  };
  const toggleTableSelected = (tableId: number) => {
    setSelectedTableIds(prev => {
      const s = new Set(prev);
      if (s.has(tableId)) s.delete(tableId); else s.add(tableId);
      return s;
    });
  };

  // Confirma la transferencia de TODAS las mesas seleccionadas al mesero destino.
  // El endpoint /api/tabletransfer ya acepta `tableIds` como arreglo, así que un solo
  // POST en lote cubre todas las mesas. El mesero destino deberá aceptarlas.
  const confirmTransferSelected = async () => {
    const tableIds = [...selectedTableIds];
    if (tableIds.length === 0 || !transferToWaiterId) {
      toast.error('Selecciona mesas y mesero destino');
      return;
    }
    setSendingTransfer(true);
    try {
      const token = localStorage.getItem('waiter_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await api.post('/api/tabletransfer', {
        fromWaiterId: getUserId(user),
        toWaiterId: transferToWaiterId,
        tableIds
      });
      toast.success(`Solicitud de transferencia enviada (${tableIds.length} mesa${tableIds.length !== 1 ? 's' : ''})`);
      exitTransferMode();
      if (user) { loadData(getUserId(user)); loadVirtualTables(); }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al enviar');
    } finally {
      setSendingTransfer(false);
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

  const handleLogout = async () => {
    // SHIFT — cerrar el turno activo antes de salir (turno auto-gestionado por login/logout).
    try {
      const token = localStorage.getItem('waiter_token');
      if (activeShift?.id && token) {
        await api.put(`/api/waitershift/${activeShift.id}/end`, { unassignOrders: false }, { headers: { Authorization: `Bearer ${token}` } });
      }
    } catch { /* no bloquear el logout si falla el cierre del turno */ }
    localStorage.removeItem('waiter_token');
    localStorage.removeItem('waiter_user');
    window.location.href = '/login';
  };

  if (loading || !mounted) {
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            {/* IZQUIERDA: título + Ventas/Propinas */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Waiter App</h1>
                <p className="text-sm text-gray-600">Bienvenido, {user?.firstName || user?.name || 'Usuario'}</p>
              </div>
              {/* Estadísticas */}
              <div className="flex gap-2 sm:gap-4">
                <div className="bg-green-50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Ventas</p>
                  <p className="text-lg font-bold text-green-700">RD$ {stats.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Propinas</p>
                  <p className="text-lg font-bold text-blue-700">RD$ {stats.totalTips.toFixed(2)}</p>
                </div>
              </div>
            </div>
            {/* DERECHA: campana + En turno + reloj + Salir, alineados al borde derecho */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
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

              {/* SHIFT — turno auto-gestionado por login/logout. Sin botón de cerrar:
                  el admin ve el "tiempo en turno" en el módulo de Usuarios. */}
              {activeShift && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  En turno
                </span>
              )}

              {/* Reloj digital — movido a la derecha, antes de Salir */}
              <DigitalClock />

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
                      Iniciado a las {new Date(activeShift.startTime).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
                        {n.timestamp.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
          <button
            onClick={() => setView('plano')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              view === 'plano' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Plano
          </button>
        </div>
        {/* QR-MESA-DIRECT.1: botón "Identificar mesa por QR" eliminado.
            La identificación se hace tap directo en la card de la mesa (vista Mesas General). */}
        <button
          onClick={() => { setShowVirtualTableModal(true); loadVirtualTables(); }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          <Users className="w-5 h-5" />
          Crear mesa virtual
        </button>
        {/* CHANGE-TABLE.2: botón eliminado — "Mover comensal a otra mesa" del modal de orden ya cubre el caso. */}
        {/* Transferir mesas — visible SOLO en la vista "Mis Mesas" (un waiter no transfiere mesas
            que aún no le pertenecen). Si hay transferencias PENDIENTES dirigidas a este waiter,
            mostramos un botón ALERT igual en "Mesas General" para que pueda aceptarlas — UX safety. */}
        {/* TAREA 5: en "Mis Mesas" este botón ENTRA/SALE del modo transferencia (multi-selección
            con checks sobre las tarjetas). En "Mesas General" sólo alerta de transferencias
            pendientes por aceptar (el panel inferior las acepta/rechaza). */}
        {view === 'my-tables' ? (
          <button
            type="button"
            onClick={() => { if (transferMode) { exitTransferMode(); } else { enterTransferMode(); } }}
            aria-pressed={transferMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg relative transition-colors ${
              transferMode
                ? 'bg-teal-800 text-white shadow-inner ring-2 ring-teal-300'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
            title={transferMode ? 'Salir del modo transferencia' : 'Transferir mis mesas a otro mesero'}
          >
            <Share2 className="w-5 h-5" />
            {transferMode ? 'TRANSFIRIENDO… (toca para salir)' : 'TRANSFERIR MESAS'}
          </button>
        ) : pendingTransfers.length > 0 ? (
          <button
            type="button"
            onClick={() => loadPendingTransfers()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 relative"
            title="Tienes transferencias pendientes por aceptar"
          >
            <Share2 className="w-5 h-5" />
            {`Transferencias (${pendingTransfers.length})`}
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">{pendingTransfers.length}</span>
          </button>
        ) : null}

        {/* TAREA 4: Filtro de reservas de UN SOLO DÍA con mini-calendario (default = hoy). */}
        {(() => {
          const isCustomDay = selectedDay !== todayKey;
          const dayLabel = selectedDay
            ? (() => {
                const [y, m, d] = selectedDay.split('-').map(Number);
                return new Date(y, m - 1, d).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
              })()
            : 'Selecciona';
          return (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker(s => !s)}
                aria-label="Filtrar reservas por día"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 border transition-colors ${
                  isCustomDay ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                }`}
              >
                <Clock className={`w-4 h-4 ${isCustomDay ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className={`text-xs font-semibold ${isCustomDay ? 'text-blue-700' : 'text-gray-500'}`}>
                  Reservas
                </span>
                <span className={`text-xs font-medium capitalize ${isCustomDay ? 'text-blue-700' : 'text-slate-700'}`}>
                  {dayLabel}
                </span>
                {reservedTableIdsInRange.size > 0 && (
                  <span
                    className="ml-0.5 text-[10px] font-bold text-yellow-700 bg-yellow-100 border border-yellow-300 px-1.5 py-0.5 rounded-full"
                    title={`${reservedTableIdsInRange.size} mesa(s) reservada(s) ese día`}
                  >
                    {reservedTableIdsInRange.size}
                  </span>
                )}
                {showDatePicker
                  ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              {showDatePicker && (
                <>
                  {/* backdrop para cerrar al hacer click fuera */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                  <div className="absolute right-0 mt-2 z-50 w-72 border border-gray-200 rounded-xl p-3 bg-white shadow-xl">
                    {/* Header con navegación de mes */}
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => setDpMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                        aria-label="Mes anterior"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                      </button>
                      <p className="text-sm font-bold capitalize text-slate-700">
                        {dpMonth.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDpMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                        aria-label="Mes siguiente"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                    {/* Labels de día de la semana */}
                    <div className="grid grid-cols-7 mb-1">
                      {['D','L','M','M','J','V','S'].map((d, i) => (
                        <span key={i} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</span>
                      ))}
                    </div>
                    {/* Grid de días (tablet-friendly: h-10) */}
                    <div className="grid grid-cols-7 gap-0.5">
                      {(() => {
                        const year = dpMonth.getFullYear();
                        const month = dpMonth.getMonth();
                        const firstDay = new Date(year, month, 1).getDay();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const cells: any[] = [];
                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`b${i}`} />);
                        for (let d = 1; d <= daysInMonth; d++) {
                          const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const isToday = ymd === todayKey;
                          const isSelected = ymd === selectedDay;
                          cells.push(
                            <button
                              key={ymd}
                              type="button"
                              onClick={() => { setSelectedDay(ymd); setShowDatePicker(false); }}
                              className={[
                                'h-10 w-full text-sm rounded-md transition-colors',
                                isSelected
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
                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => { setSelectedDay(todayKey); setDpMonth(new Date()); setShowDatePicker(false); }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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
                    <span className="font-mono">Pedido #{shortOrder(o.orderNumber ?? (o as any).orderNumber)}</span>
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
        {view === 'plano' ? (
          // Vista Plano del salón (solo lectura) — click en mesa → ver el pedido
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Plano del salón</h2>
              <span className="text-xs text-gray-500">Toca una mesa para ver su pedido</span>
            </div>
            <div style={{ height: 560 }} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <MultiZoneFloorPlanViewer
                data={floorPlanData}
                palette={floorPlanPalette}
                fill
                fitToContent
                selectedTableId={planoSel ?? undefined}
                onTableClick={(id: string | number) => {
                  setPlanoSel(id);
                  const tid = Number(id);
                  const order = [...generalOrders, ...myOrders].find((o: any) => Number(o.tableId ?? o.TableId) === tid);
                  if (order) { setOrderModalOrder(order); setShowOrderModal(true); return; }
                  const t = tables.find((x: any) => Number(x.id) === tid);
                  if (t) {
                    if (t.status === 'Reserved') { openReservedTableInfo(t.id); return; }
                    if (t.status === 'Available') { setConfirmIdentifyTable({ id: t.id, tableNumber: t.tableNumber, zoneName: t.zoneName }); return; }
                  }
                  toast('Mesa ocupada — sin pedido asignado a ti', { icon: 'ℹ️' });
                }}
              />
            </div>
          </div>
        ) : view === 'general' ? (
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
                
                
                const tablesNotMine = tables.filter(t => {
                  const inMyOrders = myOrders.some(o => String(o.tableNumber) === String(t.tableNumber));
                  const inVirtualTable = virtualTableIds.includes(t.id);
                  
                  if (inVirtualTable) {
                  }
                  
                  return !inMyOrders && !inVirtualTable;
                });
                
                
                return (
                  <>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Todas las Mesas ({tablesNotMine.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tablesNotMine.map((table) => {
                  const unassignedOrder = generalOrders.find(o => String(o.tableNumber) === String(table.tableNumber));
                  const hasUnassigned = !!unassignedOrder;

                  // RES-RANGE: override Reserved si está en el set del filtro de fechas
                  const isReservedInRange = reservedTableIdsInRange.has(table.id);
                  const effectiveStatus = isReservedInRange ? 'Reserved' : table.status;
                  return (
                    <div
                      key={table.id}
                      className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${
                        effectiveStatus === 'Occupied'
                          ? 'border-red-500 bg-red-50 hover:bg-red-100'
                          : effectiveStatus === 'Reserved'
                          ? 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                          : 'border-green-500 bg-green-50 hover:bg-green-100 hover:border-green-600'
                      }`}
                      onClick={() => {
                        if (hasUnassigned) {
                          setOrderModalOrder(unassignedOrder);
                          setShowOrderModal(true);
                        } else if (effectiveStatus === 'Reserved') {
                          // RES-DETAIL.3: abrir popup con datos del cliente reservante
                          openReservedTableInfo(table.id);
                        } else if (effectiveStatus === 'Available') {
                          // QR-MESA-DIRECT.1: tap directo → confirmar identificación de mesa
                          setConfirmIdentifyTable({ id: table.id, tableNumber: table.tableNumber, zoneName: table.zoneName });
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
            {/* TAREA 5: banda de ayuda mientras el modo transferencia está activo */}
            {transferMode && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-center gap-2 text-sm text-teal-800">
                <Share2 className="w-4 h-4 flex-shrink-0" />
                <span>Modo transferencia activo: toca las mesas que quieras transferir. Selecciona el mesero destino abajo y confirma.</span>
              </div>
            )}
            {(() => {
              // Filtrar órdenes que NO estén en mesas virtuales
              const virtualTableIds = virtualTablesList.flatMap(vt => {
                const vtTables = Array.isArray(vt?.tables) ? vt.tables : (Array.isArray(vt?.Tables) ? vt.Tables : []);
                return vtTables.map((t: any) => t?.id ?? t?.Id);
              });
              
              
              const filteredMyOrders = myOrders.filter(o => {
                const tId = (o as any).tableId ?? (o as any).TableId;
                const isInVirtual = virtualTableIds.includes(tId);
                if (isInVirtual) {
                }
                return !isInVirtual;
              });
              
              
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

                    // ── Eventos/notificaciones del comensal (avisos destacados) ──────────
                    // No dependen de order.items (que puede venir vacío en myOrders).
                    // 1) "Pidió la cuenta": señal más confiable = estado de la MESA en 'Billing'
                    //    (se cruza `tables` por tableNumber). Refuerzo: el order trae método de
                    //    pago solicitado por el cliente (clientRequestedPaymentMethod no-vacío).
                    const cardTable = tables.find(tb => tb.tableNumber === order.tableNumber);
                    const tableIsBilling = cardTable?.status === 'Billing';
                    const clientRequestedPay = String(
                      (order as any).clientRequestedPaymentMethod ?? (order as any).ClientRequestedPaymentMethod ?? ''
                    ).trim() !== '';
                    const requestedBill = !isPaid && (tableIsBilling || clientRequestedPay);
                    // 2) "Terminó de comer": flag del comensal (mismo campo del polling, línea ~384)
                    const customerFinished =
                      !!((order as any).customerFinishedEating || (order as any).CustomerFinishedEating)
                      && order.status !== 'Served' && order.status !== 'Completed';
                    // 3) "Listo para servir": reutiliza readyToServe ya calculado (si aún no se sirvió/cobró)
                    const showReadyToServe =
                      readyToServe && order.status !== 'Served' && order.status !== 'Completed'
                      && !((!hasFoodItems || kitchenServed) && (!hasDrinkItems || barServed));
                    // ¿Hay algún aviso urgente del comensal? (badge pulsante de esquina)
                    const hasUrgentDinerEvent = requestedBill || customerFinished;

                    // TAREA 5: en modo transferencia, el click marca/desmarca la mesa (no abre el modal).
                    const cardTableId = (order as any).tableId ?? (order as any).TableId;
                    const isSelectedForTransfer = transferMode && selectedTableIds.has(cardTableId);
                    return (
                      <div
                        key={getOrderId(order)}
                        onClick={() => {
                          if (transferMode) { toggleTableSelected(cardTableId); return; }
                          setMyOrderModalOrder(order); setMyOrderModalTab(hasFoodItems ? 'kitchen' : 'bar'); setShowMyOrderModal(true);
                        }}
                        role={transferMode ? 'checkbox' : undefined}
                        aria-checked={transferMode ? isSelectedForTransfer : undefined}
                        className={`relative bg-white rounded-xl shadow border-2 p-3 cursor-pointer hover:shadow-md transition-all ${
                          isSelectedForTransfer
                            ? 'border-teal-600 ring-2 ring-teal-400 bg-teal-50/60'
                            : readyToServe && order.status !== 'Served' && order.status !== 'Completed'
                            ? 'border-green-500 bg-green-50/30'
                            : order.status === 'Served' || order.status === 'Completed'
                            ? 'border-teal-400 bg-teal-50/30'
                            : 'border-gray-200 hover:border-primary-400'
                        }`}
                      >
                        {/* TAREA 5: check de selección (esquina) en modo transferencia */}
                        {transferMode && (
                          <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center border-2 z-10 transition-colors ${
                            isSelectedForTransfer
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white border-gray-300 text-transparent'
                          }`}>
                            <Check className="w-4 h-4" strokeWidth={3} />
                          </div>
                        )}
                        {/* Aviso de esquina pulsante para eventos urgentes del comensal
                            (mismo lenguaje visual que la vista General). Rojo = pidió la
                            cuenta (prioridad); ámbar = terminó de comer. Oculto en modo transferencia. */}
                        {!transferMode && hasUrgentDinerEvent && (
                          <div
                            className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center animate-pulse z-10 ${
                              requestedBill ? 'bg-red-500' : 'bg-amber-500'
                            }`}
                            style={{ animationDuration: '0.8s' }}
                            title={requestedBill ? 'El comensal pidió la cuenta' : 'El comensal terminó de comer'}
                          >
                            <span className="text-white text-sm font-bold">{requestedBill ? '💳' : '🔔'}</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span className="text-2xl font-bold text-gray-900">#{order.tableNumber}</span>
                          <div className="flex items-center gap-1">
                            {!transferMode && claimedTableIds.has((order as any).tableId ?? (order as any).TableId) && (
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
                        <p className="text-xs text-gray-400 font-mono truncate mb-2">Pedido #{shortOrder(order.orderNumber)}</p>
                        {/* WAITER-CARD-NOTIF: el aviso del bell también se renderiza aquí, en la mesa que se atiende */}
                        {!transferMode && (() => {
                          const oid = getOrderId(order);
                          const tn = notifications.filter(n => !n.read
                            && (n.orderId === oid || (!!n.tableNumber && n.tableNumber === String(order.tableNumber))));
                          if (tn.length === 0) return null;
                          const nt = tn[0];
                          const s = NOTIF_CARD[nt.type] ?? NOTIF_CARD_DEFAULT;
                          return (
                            <div className={`mb-2 rounded-lg border px-2 py-1.5 flex items-start gap-1.5 ${s.cls} ${s.pulse ? 'animate-pulse' : ''}`} style={s.pulse ? { animationDuration: '1.4s' } : undefined}>
                              <span className="text-sm leading-none mt-0.5">{s.icon}</span>
                              <span className="flex-1 text-[11px] font-semibold leading-snug">{nt.message}</span>
                              {tn.length > 1 && <span className="text-[10px] font-bold opacity-70 mt-0.5">+{tn.length - 1}</span>}
                              <button onClick={(e) => { e.stopPropagation(); markRead(nt.id); }} className="opacity-60 hover:opacity-100 mt-0.5" aria-label="Descartar aviso">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-800">RD$ {((order as any).total ?? 0).toFixed(0)}</p>
                          <div className="flex gap-1">
                            {hasFoodItems && <span title="Cocina" className={`text-xs px-1.5 py-0.5 rounded font-bold ${kitchenServed ? 'bg-teal-100 text-teal-700' : kitchenReady ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>🍽</span>}
                            {hasDrinkItems && <span title="Bar" className={`text-xs px-1.5 py-0.5 rounded font-bold ${barServed ? 'bg-teal-100 text-teal-700' : barReady ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>🍹</span>}
                            {hasAllergies && <span title="Alergias" className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold">⚠</span>}
                          </div>
                        </div>
                        {/* Avisos destacados del comensal (apilados). No dependen de items.
                            Se ocultan en modo transferencia para no competir con la selección. */}
                        {!transferMode && (requestedBill || customerFinished || showReadyToServe) && (
                          <div className="mt-2 flex flex-col gap-1">
                            {requestedBill && (
                              <span className="w-full px-2 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center gap-1 animate-pulse" style={{ animationDuration: '1.2s' }}>
                                💳 Pidió la cuenta
                              </span>
                            )}
                            {customerFinished && (
                              <span className="w-full px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center gap-1">
                                🔔 Terminó de comer
                              </span>
                            )}
                            {showReadyToServe && (
                              <span className="w-full px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center gap-1">
                                ✓ Listo para servir
                              </span>
                            )}
                          </div>
                        )}
                        {/* TAREA 5: en modo transferencia ocultamos las acciones por-mesa para evitar
                            clicks accidentales; el card sólo se marca/desmarca. */}
                        {!transferMode && (!hasFoodItems || kitchenServed) && (!hasDrinkItems || barServed) && order.status !== 'Served' && order.status !== 'Completed' && (
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
                        {!transferMode && (order.status === 'Served' || order.status === 'Completed') && (
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
        {/* TAREA 5: espaciador para que la barra fija de transferencia no tape las últimas tarjetas */}
        {transferMode && selectedTableIds.size > 0 && <div className="h-24" aria-hidden />}
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
                  <p className="text-sm text-gray-600">Mesa {orderModalOrder.tableNumber} · Pedido #{shortOrder(orderModalOrder.orderNumber)}</p>
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
                        <div className="font-medium text-gray-800">
                          {item.quantity}x {item.dishName ?? item.DishName}
                          {(item.customerName ?? item.CustomerName) ? (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 align-middle">👤 {item.customerName ?? item.CustomerName}</span>
                          ) : null}
                        </div>
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
              const orderTableNumber = (orderModalOrder as any).tableNumber ?? (orderModalOrder as any).TableNumber ?? orderTableId;
              const isVirtualTableOrder = virtualTablesList.some((vt: any) => {
                const vtTables = Array.isArray(vt?.tables) ? vt.tables : (Array.isArray(vt?.Tables) ? vt.Tables : []);
                return vtTables.some((t: any) => (t?.id ?? t?.Id) === orderTableId);
              });
              return (
                <div className="space-y-2">
                  {/* WAITER-QR.3 — verificar físicamente la mesa antes de tomar la orden.
                      Solo en mesas reales (no virtuales) y siempre que tengamos tableId. */}
                  {orderTableId && !isVirtualTableOrder && (
                    <button
                      onClick={() => setQrVerifyContext({ tableId: Number(orderTableId), tableNumber: orderTableNumber })}
                      className="w-full px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                      title="Abrir cámara para escanear el QR físico de la mesa y verificar antes de tomar"
                    >
                      <QrCode className="w-4 h-4" />
                      Identificar mesa por QR
                    </button>
                  )}
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
                </div>
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
                    <p className="text-sm text-gray-500">Pedido #{shortOrder(selectedOrder.orderNumber)}</p>
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

      {/* QR-MESA-DIRECT.1: Mini-modal de confirmación al tap directo en card de mesa */}
      {confirmIdentifyTable && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmIdentifyTable(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header con número de mesa grande */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white px-6 py-5 text-center">
              <p className="text-xs uppercase tracking-widest text-indigo-200 mb-1">Atender Mesa</p>
              <p className="text-5xl font-black leading-none">#{confirmIdentifyTable.tableNumber}</p>
              <p className="text-sm text-indigo-100 mt-1">{confirmIdentifyTable.zoneName}</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-center text-sm text-gray-700">
                ¿Confirmas que vas a atender esta mesa? El sistema te asignará como mesero responsable.
              </p>

              <div className="flex flex-col gap-2.5">
                {/* Botón primario grande para tap fácil */}
                <button
                  onClick={() => {
                    setIdentifiedTableId(confirmIdentifyTable.id);
                    toast.success(`Mesa #${confirmIdentifyTable.tableNumber} identificada`);
                    setConfirmIdentifyTable(null);
                  }}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-base font-bold shadow-md flex items-center justify-center gap-2 transition-colors"
                >
                  <Check className="w-5 h-5" />
                  Sí, atender esta mesa
                </button>
                <button
                  onClick={() => setConfirmIdentifyTable(null)}
                  className="w-full py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WAITER-QR.1 — Modal de verificación de mesa desde modal de orden */}
      {qrVerifyContext && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setQrVerifyContext(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Identificar mesa por QR</h3>
                  <p className="text-xs text-indigo-100">Mesa esperada: <strong>#{qrVerifyContext.tableNumber}</strong></p>
                </div>
              </div>
              <button onClick={() => setQrVerifyContext(null)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed text-center">
                Apunta la cámara al código QR pegado en la mesa. El sistema verificará si coincide con la mesa de esta orden.
              </p>
              <QrScanner
                singleMode
                onScan={handleQrVerifyTable}
                onError={(msg) => toast.error(msg)}
                onClose={() => setQrVerifyContext(null)}
              />
            </div>
          </div>
        </div>
      )}

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

              {/* VT-PAY: selector de mesa pagadora (para el cobro unificado) */}
              {virtualTableIds.split(/[\s,]+/).filter(Boolean).length >= 2 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">💳 Mesa que paga el total (cobro unificado):</p>
                  <select
                    value={vtPayerTableId ?? ''}
                    onChange={e => setVtPayerTableId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="">— Selecciona la mesa pagadora —</option>
                    {virtualTableIds.split(/[\s,]+/).filter(Boolean).map(idStr => {
                      const num = parseInt(idStr, 10);
                      const t = tables.find(tb => tb.tableNumber === num || tb.id === num);
                      if (!t) return null;
                      return <option key={t.id} value={t.id}>Mesa #{t.tableNumber}{t.zoneName ? ` (${t.zoneName})` : ''}</option>;
                    })}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Esta mesa recibe el comprobante único de todo el grupo.</p>
                </div>
              )}
            </div>
            
            {/* Footer fijo con botones */}
            <div className="p-6 pt-3 border-t border-gray-200 flex gap-2">
              <button 
                type="button"
                onClick={(e) => {
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
                  <p className="text-xs text-gray-400 font-mono">Pedido #{shortOrder(order.orderNumber)}</p>
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
                        <span className="font-medium"><span className="text-primary-600">{item.quantity}x</span> {item.dishName ?? item.DishName}{(item.customerName ?? item.CustomerName) ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 align-middle">👤 {item.customerName ?? item.CustomerName}</span> : null}</span>
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
                {/* WAITER-QR.3 — botón QR movido al modal "Pedido sin asignar" (línea ~2438)
                    porque ese es el modal real que aparece en Mesas General antes de tomar la orden. */}

                {/* Quedarme con la mesa (se oculta si ya está reclamada).
                    CLAIM-MODAL.1: click directo envía la solicitud al admin, sin modal intermedio. */}
                {['Pending','Confirmed','Preparing','Ready','Served'].includes(order.status) && !claimedTableIds.has((order as any).tableId ?? (order as any).TableId) && (
                  pendingClaimTableIds.has((order as any).tableId ?? (order as any).TableId) ? (
                    <div className="w-full py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-semibold flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 animate-pulse" />
                      Solicitud pendiente — esperando admin...
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        const uid = getUserId(user);
                        const tableId = (order as any).tableId ?? (order as any).TableId;
                        if (!uid || !tableId) return;
                        try {
                          await api.post('/api/tableclaim', {
                            waiterId: uid,
                            tableId,
                            orderId: getOrderId(order) || null,
                          });
                          setPendingClaimTableIds(prev => new Set(prev).add(tableId));
                          toast(`⏳ Solicitud enviada al admin. Espera su respuesta.`, {
                            duration: 5000,
                            style: { background: '#eef2ff', color: '#4338ca', fontWeight: 600 }
                          });
                        } catch (err: any) {
                          toast.error(err?.response?.data?.error || 'Error al enviar la solicitud');
                        }
                      }}
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

      {/* CLAIM-MODAL.1: modal de confirmación "Quedarme con Mesa" eliminado.
          El click directo en el botón envía la solicitud al admin (ver onClick arriba). */}

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
            <p className="text-sm text-gray-600 mb-4">Pedido #{shortOrder(showMoveModal.order.orderNumber)} · Mesa actual: {showMoveModal.order.tableNumber}</p>
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


      {/* TAREA 5: Barra inferior de transferencia (multi-selección). Aparece cuando hay ≥1 mesa
          marcada en modo transferencia. Reutiliza waiterList + transferToWaiterId y el endpoint
          batch /api/tabletransfer vía confirmTransferSelected(). */}
      {transferMode && selectedTableIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-bold text-teal-700">
              <Share2 className="w-5 h-5" />
              {selectedTableIds.size} mesa{selectedTableIds.size !== 1 ? 's' : ''} seleccionada{selectedTableIds.size !== 1 ? 's' : ''}
            </span>
            <select
              value={transferToWaiterId ?? ''}
              onChange={e => setTransferToWaiterId(parseInt(e.target.value, 10) || null)}
              aria-label="Mesero destino"
              className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-4 py-2 text-sm"
            >
              <option value="">Seleccionar mesero destino...</option>
              {waiterList.map(w => (
                <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={confirmTransferSelected}
              disabled={selectedTableIds.size === 0 || !transferToWaiterId || sendingTransfer}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              {sendingTransfer ? 'Enviando…' : 'Confirmar transferencia'}
            </button>
            <button
              type="button"
              onClick={exitTransferMode}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Pedido manual (para mesa identificada) */}
      {showManualOrderModal && manualOrderTableId != null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[96vh] sm:h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Menú · Hacer pedido</h2>
              <p className="text-sm text-gray-500">Mesa {tables.find(t => t.id === manualOrderTableId)?.tableNumber ?? manualOrderTableId}</p>
            </div>
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
                                  <span className="font-bold text-lg text-gray-900">Pedido #{shortOrder(order.orderNumber)}</span>
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
                                {new Date(order.createdAt).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
                                      <span className="text-gray-800 font-medium"><span className="font-semibold text-purple-900">{item.quantity}x</span> {item.dishName ?? item.DishName}{(item.customerName ?? item.CustomerName) ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 align-middle">👤 {item.customerName ?? item.CustomerName}</span> : null}</span>
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
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openVtPay(showVirtualTableDetailsModal); }}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4" /> Cobrar mesa virtual
              </button>
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

      {/* VT-PAY — Modal de cobro unificado de mesa virtual */}
      {showVtPayModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={() => !vtPaying && setShowVtPayModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-emerald-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Cobrar mesa virtual</h2>
              <p className="text-sm text-emerald-50">{showVtPayModal.vt?.name ?? showVtPayModal.vt?.Name ?? 'Mesa virtual'} · {showVtPayModal.orderCount} orden(es)</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm font-semibold text-emerald-800">Total a cobrar</span>
                <span className="text-2xl font-bold text-emerald-900">RD$ {Number(showVtPayModal.total).toFixed(2)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{id:'Cash',name:'Efectivo'},{id:'Card',name:'Tarjeta'},{id:'Transfer',name:'Transferencia'},{id:'Mixed',name:'Mixto'}].map(m => (
                    <button key={m.id} type="button" onClick={() => setVtPayMethod(m.id)}
                      className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${vtPayMethod === m.id ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-700'}`}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500">Se genera un comprobante único bajo la mesa pagadora y se cierra la mesa virtual.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button type="button" disabled={vtPaying} onClick={() => setShowVtPayModal(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={vtPaying || showVtPayModal.orderCount === 0} onClick={payVirtualTable}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50">
                {vtPaying ? 'Cobrando…' : `Cobrar RD$ ${Number(showVtPayModal.total).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RES-DETAIL.3: Modal de detalles de cliente reservante */}
      {(loadingReservation || reservedInfo) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setReservedInfo(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-yellow-500 text-white px-12 py-4">
              <div className="flex items-center justify-center gap-3">
                <Clock className="w-5 h-5 flex-shrink-0" />
                <div className="text-center min-w-0">
                  <h3 className="text-lg font-bold leading-tight">
                    {reservedInfo ? `Mesa #${reservedInfo.tableNumber}` : 'Mesa Reservada'}
                  </h3>
                  {reservedInfo && (
                    <p className="text-xs text-yellow-50/90 leading-tight mt-0.5">
                      {reservedInfo.zoneName}
                      <span className="mx-1.5 opacity-60">·</span>
                      <span className="font-semibold">Reservada</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setReservedInfo(null)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {loadingReservation && (
              <div className="px-6 py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Cargando datos de la reserva...</p>
              </div>
            )}
            {reservedInfo && !loadingReservation && (
              <div className="px-6 py-5 space-y-5">
                {/* ───── SECCIÓN: CLIENTE ───────────────────────────────────────── */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                    <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500">Cliente</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 leading-tight">{reservedInfo.customerName}</p>
                  {/* TAREA 2: teléfono/email del cliente ocultos. Sólo se ofrece "Contactar" (llamada) + comensales. */}
                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    {reservedInfo.customerPhone ? (
                      <a
                        href={`tel:${reservedInfo.customerPhone}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2.5 transition-colors flex items-center justify-center gap-1.5 font-semibold"
                        aria-label="Contactar al cliente por teléfono"
                      >
                        <Phone className="w-4 h-4" />Contactar
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="bg-gray-100 text-gray-400 rounded-lg p-2.5 flex items-center justify-center gap-1.5 font-semibold cursor-not-allowed"
                        title="Sin teléfono registrado"
                      >
                        <Phone className="w-4 h-4" />Contactar
                      </button>
                    )}
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />Comensales
                      </p>
                      <p className="font-semibold text-gray-900">
                        {reservedInfo.numberOfGuests} {reservedInfo.numberOfGuests === 1 ? 'persona' : 'personas'}
                      </p>
                    </div>
                  </div>
                </section>

                {/* ───── SECCIÓN: RESERVA ───────────────────────────────────────── */}
                <section className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                    <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500">Reserva</p>
                  </div>

                  {/* Hora reservada */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Hora reservada</p>
                      <p className="font-bold text-amber-900">
                        {new Date(reservedInfo.reservationDateTime).toLocaleString('es-DO', {
                          weekday: 'short', day: 'numeric', month: 'short',
                          hour: 'numeric', minute: '2-digit', hour12: true
                        })}
                      </p>
                      {reservedInfo.reservedUntil && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Mesa bloqueada hasta {new Date(reservedInfo.reservedUntil).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* TAREA 3: bloque "Recibida por: …" eliminado del render (el campo createdByHostName sigue en la interface). */}
                </section>

                {/* ───── SECCIÓN: NOTAS / PRE-ORDEN ─────────────────────────────── */}
                {(reservedInfo.specialRequests || (reservedInfo.preOrder && reservedInfo.preOrder.items && reservedInfo.preOrder.items.length > 0)) && (
                  <section className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                      <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500">Notas del cliente</p>
                    </div>
                    {reservedInfo.specialRequests && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-[10px] uppercase tracking-wider text-orange-700 font-semibold mb-1">Solicitudes especiales</p>
                        <p className="text-sm text-orange-900">{reservedInfo.specialRequests}</p>
                      </div>
                    )}
                    {reservedInfo.preOrder && reservedInfo.preOrder.items && reservedInfo.preOrder.items.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-2 flex items-center gap-1">
                          <Utensils className="w-3 h-3" />
                          Pre-orden ({reservedInfo.preOrder.items.length} {reservedInfo.preOrder.items.length === 1 ? 'plato' : 'platos'})
                        </p>
                        <ul className="space-y-1">
                          {reservedInfo.preOrder.items.map((it, idx) => (
                            <li key={idx} className="text-sm flex justify-between">
                              <span className="font-medium">{it.quantity}x {it.dishName}</span>
                              {it.notes && <span className="text-gray-500 text-xs">{it.notes}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => setReservedInfo(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium"
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

// Normaliza un plato (acepta PascalCase y camelCase) a una forma estable.
function normalizeDish(d: any) {
  return {
    id: (d.id ?? d.Id) as number,
    name: (d.name ?? d.Name ?? '') as string,
    price: Number(d.price ?? d.Price ?? 0),
    desc: (d.description ?? d.Description ?? '') as string,
    img: (d.imageUrl ?? d.ImageUrl ?? '') as string,
    cat: (d.categoryName ?? d.CategoryName ?? 'Otros') as string,
    available: (d.isAvailable ?? d.IsAvailable ?? true) !== false,
    defaultCourse: (d.defaultCourse ?? d.DefaultCourse ?? null) as number | null,
  };
}

type NormalizedDish = ReturnType<typeof normalizeDish>;

// ─── Detección y opciones de detalle (espejo del DishModal del cliente) ───
const MANUAL_DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'coctel', 'refresco', 'agua', 'cafe', 'café', 'té', 'te', 'bebida', 'margarita', 'ron', 'whisky', 'whiskey', 'colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi', 'sprite', 'fanta', 'ginger', 'tónica', 'tonica', 'lager', 'pilsner'];
const MANUAL_MEAT_KEYWORDS = ['carne', 'filete', 'res', 'pollo', 'cerdo', 'chuleta', 'bistec', 'steak', 'ribeye', 'rib eye', 'churrasco', 'sirloin', 'mignon', 'picaña', 'picana', 'cordero', 'chivo', 'costilla', 'lomo', 'pechuga', 'ternera'];

// Opciones de cocción — key = valor del backend, label = chip, short = resumen del carrito.
const MANUAL_COOKING_OPTIONS = [
  { key: 'Rare',     label: '💧 Poco',  short: 'Poco' },
  { key: 'Medium',   label: '🔥 Medio', short: 'Medio' },
  { key: 'WellDone', label: '✅ Bien',  short: 'Bien cocido' },
];
const MANUAL_DESSERT_CATEGORY_KEYWORDS = ['postre', 'dulce', 'dessert', 'helado', 'repostería'];
const MANUAL_STARTER_CATEGORY_KEYWORDS = ['entrada', 'aperitivo', 'starter'];

function manualDetectIsDrink(name: string): boolean {
  const lower = (name ?? '').toLowerCase();
  return MANUAL_DRINK_KEYWORDS.some((k) => lower.includes(k));
}
function manualDetectHasMeat(name: string): boolean {
  const lower = (name ?? '').toLowerCase();
  return MANUAL_MEAT_KEYWORDS.some((k) => lower.includes(k));
}

const MANUAL_COURSE_OPTIONS = [
  { value: 0, label: 'Entrada',      icon: '🥗', desc: 'Sirve primero' },
  { value: 1, label: 'Plato Fuerte', icon: '🍖', desc: 'Plato principal' },
  { value: 2, label: 'Postre',       icon: '🍰', desc: 'Al final' },
];
const MANUAL_LIGA_OPTIONS = [
  { value: '', label: 'Solo / Sin liga' },
  { value: 'Soda',             label: '🫧 Soda' },
  { value: 'Agua Tónica',      label: '💧 Agua Tónica' },
  { value: 'Jugo de Naranja',  label: '🍊 Jugo de Naranja' },
  { value: 'Jugo de Piña',     label: '🍍 Jugo de Piña' },
  { value: 'Refresco Cola',    label: '🥤 Refresco Cola' },
  { value: 'Agua Natural',     label: '💦 Agua Natural' },
  { value: 'Ginger Ale',       label: '🫙 Ginger Ale' },
  { value: 'Jugo de Tomate',   label: '🍅 Jugo de Tomate' },
];
type SelectedItem = {
  /** id único de línea — cada "Agregar" crea una línea independiente (no se fusiona por dishId). */
  lineId: number;
  dishId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  // Preferencias y detalles (espejo del DishModal del cliente)
  meatCooking?: string;
  sideDish?: string;
  customizations?: string;
  allergies?: string;
  drinkTiming?: string;
  withAlcohol?: boolean;
  liga?: string;
  /** 0=Entrada, 1=PlatoFuerte, 2=Postre */
  courseTiming?: number;
};

/** Preferencias de UNA unidad de un plato (carne) en el configurador por unidad. */
type UnitPref = { meatCooking: string; sideDish: string; customizations: string; allergies: string; notes: string };
const EMPTY_UNIT: UnitPref = { meatCooking: '', sideDish: '', customizations: '', allergies: '', notes: '' };

const MANUAL_TODAS = '__all__';

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
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  // Generador de id de línea (estable entre renders) + línea en edición (null = agregar nueva).
  const lineIdRef = useRef(1);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Filtros del menú (estilo cliente)
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>(MANUAL_TODAS);
  // Detalle del plato (sub-modal sobre el menú) — mismos campos que el cliente
  const [detailDish, setDetailDish] = useState<NormalizedDish | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState('');
  // Preferencias comida (cocción/guarnición/notas son por unidad → ver detailUnits)
  const [detailCourseTiming, setDetailCourseTiming] = useState(1); // default PlatoFuerte
  // Preferencias bebida
  const [detailDrinkTiming, setDetailDrinkTiming] = useState('');
  const [detailWithAlcohol, setDetailWithAlcohol] = useState<boolean | null>(null);
  const [detailLiga, setDetailLiga] = useState('');
  // Configurador por unidad (carnes): una preferencia por cada unidad de la cantidad.
  const [detailUnits, setDetailUnits] = useState<UnitPref[]>([]);
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const setUnitField = (i: number, field: keyof UnitPref, value: string) =>
    setDetailUnits(prev => prev.map((u, idx) => (idx === i ? { ...u, [field]: value } : u)));
  const applyCookingToAll = (cooking: string) =>
    setDetailUnits(prev => prev.map(u => ({ ...u, meatCooking: cooking })));
  // Cambia la cantidad. Toda la COMIDA va por unidad (redimensiona unidades, nuevas heredan la
  // última); las BEBIDAS usan cantidad simple y se dividen en N líneas al confirmar.
  const changeDetailQty = (next: number) => {
    const q = Math.max(1, Math.min(99, next));
    setDetailQty(q);
    if (detailDish && !manualDetectIsDrink(detailDish.name)) {
      setDetailUnits(prev => {
        const arr = prev.slice(0, q);
        while (arr.length < q) arr.push(arr.length ? { ...arr[arr.length - 1] } : { ...EMPTY_UNIT });
        return arr;
      });
    }
  };

  const decrement = (lineId: number) => {
    setSelected(prev => {
      const s = prev.find(x => x.lineId === lineId);
      if (!s) return prev;
      if (s.quantity <= 1) return prev.filter(x => x.lineId !== lineId);
      return prev.map(x => x.lineId === lineId ? { ...x, quantity: x.quantity - 1 } : x);
    });
  };
  const subtotal = selected.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;
  const itemCount = selected.reduce((n, s) => n + s.quantity, 0);

  const submit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      // El backend (CreateOrderItemDto) acepta por ítem: notes, drinkTiming, withAlcohol,
      // meatCooking, sideDish, customizations, allergies, courseTiming.
      // Enviamos los mismos nombres/lógica que el client-app (cart/page.tsx).
      await api.post('/api/order', {
        tableId,
        sessionId: `manual-${Date.now()}`,
        items: selected.map(s => {
          // `liga` no tiene columna propia → se concatena en customizations (igual que el cliente).
          const customizations = [s.customizations, s.liga ? `Liga: ${s.liga}` : '']
            .filter(Boolean)
            .join(' | ') || undefined;
          return {
            dishId: s.dishId,
            quantity: s.quantity,
            unitPrice: s.price,
            ...(s.notes ? { notes: s.notes } : {}),
            ...(s.drinkTiming ? { drinkTiming: s.drinkTiming } : {}),
            ...(s.withAlcohol !== undefined ? { withAlcohol: s.withAlcohol } : {}),
            ...(s.meatCooking ? { meatCooking: s.meatCooking } : {}),
            ...(s.sideDish ? { sideDish: s.sideDish } : {}),
            ...(customizations ? { customizations } : {}),
            ...(s.allergies ? { allergies: s.allergies } : {}),
            ...(s.courseTiming !== undefined ? { courseTiming: s.courseTiming } : {}),
          };
        })
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al crear pedido');
    } finally {
      setSubmitting(false);
    }
  };

  // Platos disponibles, normalizados una sola vez.
  const availableDishes = dishes.map(normalizeDish).filter(d => d.available && d.id != null);
  // Categorías presentes (orden de aparición).
  const categories = availableDishes.reduce<string[]>((acc, d) => {
    if (!acc.includes(d.cat)) acc.push(d.cat);
    return acc;
  }, []);

  // Filtrado combinado: categoría + búsqueda (nombre o descripción).
  const q = search.trim().toLowerCase();
  const visibleDishes = availableDishes.filter(d => {
    if (activeCat !== MANUAL_TODAS && d.cat !== activeCat) return false;
    if (q && !d.name.toLowerCase().includes(q) && !d.desc.toLowerCase().includes(q)) return false;
    return true;
  });

  // Abre el sub-modal de detalle.
  //  • Sin `editLine` (desde la tarjeta del menú) → AGREGAR una línea nueva con valores por defecto.
  //  • Con `editLine` (al tocar una línea del carrito) → EDITAR esa línea, precargando sus datos.
  const openDetail = (d: NormalizedDish, editLine?: SelectedItem) => {
    setEditingLineId(editLine?.lineId ?? null);
    setDetailDish(d);
    setDetailQty(editLine?.quantity && editLine.quantity > 0 ? editLine.quantity : 1);
    setDetailNotes(editLine?.notes ?? '');
    // Curso por defecto: categoría manda (entrada→0, postre→2); si no, DefaultCourse del plato.
    const catL = (d.cat ?? '').toLowerCase();
    let course = editLine?.courseTiming ?? d.defaultCourse ?? 1;
    if (editLine?.courseTiming === undefined) {
      if (MANUAL_STARTER_CATEGORY_KEYWORDS.some(k => catL.includes(k))) course = 0;
      else if (MANUAL_DESSERT_CATEGORY_KEYWORDS.some(k => catL.includes(k))) course = 2;
    }
    setDetailCourseTiming(course);
    setDetailDrinkTiming(editLine?.drinkTiming ?? '');
    setDetailWithAlcohol(editLine?.withAlcohol ?? null);
    setDetailLiga(editLine?.liga ?? '');
    // Inicializa las unidades (carnes): N copias de las prefs de la línea (o 1 vacía).
    const unitCount = editLine?.quantity && editLine.quantity > 0 ? editLine.quantity : 1;
    setDetailUnits(Array.from({ length: unitCount }, () => ({
      meatCooking: editLine?.meatCooking ?? '',
      sideDish: editLine?.sideDish ?? '',
      customizations: editLine?.customizations ?? '',
      allergies: editLine?.allergies ?? '',
      notes: editLine?.notes ?? '',
    })));
    setExpandedUnit(null);
  };
  const closeDetail = () => {
    setEditingLineId(null);
    setDetailDish(null);
    setDetailQty(1);
    setDetailNotes('');
    setDetailCourseTiming(1);
    setDetailDrinkTiming('');
    setDetailWithAlcohol(null);
    setDetailLiga('');
    setDetailUnits([]);
    setExpandedUnit(null);
  };
  // Confirma el detalle: crea una línea por unidad (comida) o N unidades separadas (bebidas).
  const confirmDetail = () => {
    if (!detailDish) return;
    const d = detailDish;
    const isDrink = manualDetectIsDrink(d.name);

    if (!isDrink) {
      // COMIDA (entrada/plato fuerte/postre): cada unidad es una línea (cant. 1) con su detalle.
      const units = detailUnits.length ? detailUnits : [EMPTY_UNIT];
      const lines: SelectedItem[] = units.map((u, i) => ({
        lineId: editingLineId != null && i === 0 ? editingLineId : lineIdRef.current++,
        dishId: d.id, name: d.name, price: d.price, quantity: 1,
        courseTiming: detailCourseTiming,
        ...(u.meatCooking ? { meatCooking: u.meatCooking } : {}),
        ...(u.sideDish ? { sideDish: u.sideDish } : {}),
        ...(u.customizations.trim() ? { customizations: u.customizations.trim() } : {}),
        ...(u.allergies.trim() ? { allergies: u.allergies.trim() } : {}),
        ...(u.notes.trim() ? { notes: u.notes.trim() } : {}),
      }));
      setSelected(prev => editingLineId != null
        ? [...prev.map(s => (s.lineId === editingLineId ? lines[0] : s)), ...lines.slice(1)]
        : [...prev, ...lines]);
      closeDetail();
      return;
    }

    // BEBIDAS: preferencia compartida en el modal, pero se crean N unidades separadas
    // (cada una editable desde el carrito). Nada se consolida.
    const clean = detailNotes.trim() || undefined;
    const prefs: Partial<SelectedItem> = {};
    if (detailDrinkTiming) prefs.drinkTiming = detailDrinkTiming;
    if (detailWithAlcohol !== null) prefs.withAlcohol = detailWithAlcohol;
    if (detailWithAlcohol === true && detailLiga) prefs.liga = detailLiga;
    const dtMap: Record<string, number> = { Before: 0, During: 1, After: 2 };
    if (detailDrinkTiming && dtMap[detailDrinkTiming] !== undefined) prefs.courseTiming = dtMap[detailDrinkTiming];
    const dlines: SelectedItem[] = Array.from({ length: detailQty }, (_, i) => ({
      lineId: editingLineId != null && i === 0 ? editingLineId : lineIdRef.current++,
      dishId: d.id, name: d.name, price: d.price, quantity: 1, notes: clean, ...prefs,
    }));
    setSelected(prev => editingLineId != null
      ? [...prev.map(s => (s.lineId === editingLineId ? dlines[0] : s)), ...dlines.slice(1)]
      : [...prev, ...dlines]);
    closeDetail();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      {/* Menú digital — búsqueda + chips de categoría + tarjetas */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Barra de búsqueda + filtros (sticky) */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-5 py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar platos..."
              className="w-full h-11 sm:h-12 pl-9 pr-3 border border-gray-300 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto flex-nowrap pb-1 -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveCat(MANUAL_TODAS)}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                activeCat === MANUAL_TODAS ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                  activeCat === cat ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de tarjetas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {visibleDishes.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No se encontraron platos.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {visibleDishes.map(d => {
                const qty = selected.filter(s => s.dishId === d.id).reduce((n, s) => n + s.quantity, 0);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => openDetail(d)}
                    className={`text-left flex flex-col rounded-xl border overflow-hidden transition-colors ${
                      qty > 0 ? 'border-green-400 bg-green-50/40' : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="h-32 sm:h-36 bg-gray-100 overflow-hidden flex items-center justify-center">
                      {d.img ? (
                        <img
                          src={d.img}
                          alt={d.name}
                          className="w-full h-full object-cover"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.onerror = null;
                          }}
                        />
                      ) : (
                        <Utensils className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="p-3 sm:p-4 flex-1 flex flex-col">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">{d.name}</p>
                      {d.desc && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">{d.desc}</p>}
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                        <p className="text-sm sm:text-base font-bold text-green-600">RD$ {d.price.toFixed(2)}</p>
                        <span className={`inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold ${
                          qty > 0 ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'
                        }`}>
                          {qty > 0 ? `Agregar (${qty})` : 'Agregar'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Carrito / Pedido */}
      <div className="lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col bg-gray-50 max-h-[42vh] lg:max-h-none">
        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
          <p className="text-sm font-bold text-gray-700 mb-3">Pedido ({itemCount})</p>
          {selected.length === 0 && <p className="text-gray-400 text-sm">Añade platos del menú</p>}
          <div className="space-y-2">
            {(() => {
              // Agrupar por plato → cabecera "N× Plato" con una fila por unidad/línea.
              const groups: { dishId: number; name: string; lines: SelectedItem[] }[] = [];
              const idx = new Map<number, number>();
              for (const s of selected) {
                if (!idx.has(s.dishId)) { idx.set(s.dishId, groups.length); groups.push({ dishId: s.dishId, name: s.name, lines: [] }); }
                groups[idx.get(s.dishId)!].lines.push(s);
              }
              return groups.map(g => {
                const gQty = g.lines.reduce((n, s) => n + s.quantity, 0);
                const gPrice = g.lines.reduce((sum, s) => sum + s.price * s.quantity, 0);
                const perUnit = g.lines.length > 1;
                // Resumen de preferencias de una línea (reutilizado en ambos modos).
                const prefSummary = (s: SelectedItem) => {
                  const courseLabel = s.courseTiming !== undefined
                    ? MANUAL_COURSE_OPTIONS.find(o => o.value === s.courseTiming)?.label
                    : undefined;
                  return (
                    <span className="mt-0.5 block space-y-0.5">
                      {courseLabel && <span className="block text-[11px] text-gray-400 truncate">⏱ {courseLabel}</span>}
                      {s.sideDish && <span className="block text-[11px] text-gray-400 truncate">🍽 {s.sideDish}</span>}
                      {s.withAlcohol !== undefined && <span className="block text-[11px] text-gray-400 truncate">{s.withAlcohol ? '🍹 Con alcohol' : '🥤 Sin alcohol'}</span>}
                      {s.liga && <span className="block text-[11px] text-gray-400 truncate">🥤 {s.liga}</span>}
                      {s.drinkTiming && <span className="block text-[11px] text-gray-400 truncate">⏱ {s.drinkTiming}</span>}
                      {s.customizations && <span className="block text-[11px] text-gray-400 italic truncate">✏ {s.customizations}</span>}
                      {s.allergies && <span className="block text-[11px] text-red-500 font-medium truncate">⚠ {s.allergies}</span>}
                      {s.notes && <span className="block text-[11px] text-gray-400 italic truncate">📝 {s.notes}</span>}
                    </span>
                  );
                };

                // SIMPLE — una sola línea ×cantidad (platos sin carne, bebidas, o un único ítem).
                if (!perUnit) {
                  const s = g.lines[0];
                  const cookLabel = s.meatCooking
                    ? (MANUAL_COOKING_OPTIONS.find(o => o.key === s.meatCooking)?.short ?? s.meatCooking)
                    : undefined;
                  return (
                    <div key={g.dishId} className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                      <div className="flex justify-between items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { const dd = availableDishes.find(x => x.id === s.dishId); if (dd) openDetail(dd, s); }}
                          className="flex items-center gap-1 text-left flex-1 min-w-0 group"
                          aria-label={`Editar ${s.name}`}
                        >
                          <span className="text-sm font-semibold text-gray-800 truncate group-hover:text-green-700">{s.quantity}x {g.name}</span>
                          {cookLabel && <span className="text-xs text-gray-500 flex-shrink-0">· 🔥 {cookLabel}</span>}
                          <Pencil className="w-3 h-3 text-gray-300 group-hover:text-green-600 flex-shrink-0" />
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button type="button" onClick={() => decrement(s.lineId)} aria-label="Quitar" className="w-8 h-8 -my-0.5 flex items-center justify-center text-gray-400 hover:text-red-500 font-bold text-lg leading-none">−</button>
                          <span className="text-sm text-gray-900 font-medium tabular-nums">RD$ {(s.price * s.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                      {prefSummary(s)}
                    </div>
                  );
                }

                // POR UNIDAD — varias unidades (carnes): cabecera "N× Plato" + filas Unidad N.
                return (
                  <div key={g.dishId} className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 truncate">{gQty}x {g.name}</span>
                      <span className="text-sm text-gray-900 font-medium tabular-nums flex-shrink-0">RD$ {gPrice.toFixed(2)}</span>
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                      {g.lines.map((s, i) => {
                        const cookLabel = s.meatCooking
                          ? (MANUAL_COOKING_OPTIONS.find(o => o.key === s.meatCooking)?.short ?? s.meatCooking)
                          : undefined;
                        return (
                          <div key={s.lineId} className="flex items-start gap-1.5 border-l-2 border-gray-100 pl-2">
                            <button
                              type="button"
                              onClick={() => { const dd = availableDishes.find(x => x.id === s.dishId); if (dd) openDetail(dd, s); }}
                              className="flex-1 min-w-0 text-left group"
                              aria-label={`Editar ${s.name}`}
                            >
                              <span className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-semibold text-gray-600 group-hover:text-green-700">Unidad {i + 1}</span>
                                {cookLabel && <span className="text-xs text-gray-500">· 🔥 {cookLabel}</span>}
                                <Pencil className="w-3 h-3 text-gray-300 group-hover:text-green-600 flex-shrink-0" />
                              </span>
                              {prefSummary(s)}
                            </button>
                            <button type="button" onClick={() => decrement(s.lineId)} aria-label="Quitar" className="w-8 h-8 -my-0.5 flex items-center justify-center text-gray-400 hover:text-red-500 font-bold text-lg leading-none flex-shrink-0">−</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 bg-white space-y-1">
          <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>RD$ {subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm text-gray-500"><span>ITBIS 18%</span><span>RD$ {tax.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-gray-900 text-base pt-1"><span>Total</span><span>RD$ {total.toFixed(2)}</span></div>
          <div className="flex gap-2 pt-3">
            <button type="button" onClick={onClose} className="flex-1 min-h-[44px] py-2.5 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
            <button type="button" onClick={submit} disabled={selected.length === 0 || submitting} className="flex-1 min-h-[44px] py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {submitting ? 'Creando...' : 'Crear pedido'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: Detalle del plato (sobre el modal de menú) */}
      {detailDish && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-2 sm:p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Imagen grande */}
            <div className="relative h-44 sm:h-52 bg-gray-100 flex items-center justify-center flex-shrink-0">
              {detailDish.img ? (
                <img
                  src={detailDish.img}
                  alt={detailDish.name}
                  className="w-full h-full object-cover"
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.onerror = null;
                  }}
                />
              ) : (
                <Utensils className="w-12 h-12 text-gray-300" />
              )}
              <button
                type="button"
                onClick={closeDetail}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg"
                aria-label="Cerrar detalle"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">{detailDish.name}</h3>
              {detailDish.desc && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{detailDish.desc}</p>}
              <p className="text-2xl font-bold text-green-600 mt-3">RD$ {detailDish.price.toFixed(2)}</p>

              {/* Selector de cantidad */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => changeDetailQty(detailQty - 1)}
                    disabled={detailQty <= 1}
                    className="w-11 h-11 rounded-full bg-gray-100 text-gray-700 hover:bg-green-600 hover:text-white transition-colors flex items-center justify-center disabled:opacity-40 disabled:hover:bg-gray-100 disabled:hover:text-gray-700"
                    aria-label="Disminuir cantidad"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-2xl font-bold w-10 text-center text-gray-900 tabular-nums">{detailQty}</span>
                  <button
                    type="button"
                    onClick={() => changeDetailQty(detailQty + 1)}
                    disabled={detailQty >= 99}
                    className="w-11 h-11 rounded-full bg-gray-100 text-gray-700 hover:bg-green-600 hover:text-white transition-colors flex items-center justify-center disabled:opacity-40"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {(() => {
                const isDrink = manualDetectIsDrink(detailDish.name);
                const hasMeat = !isDrink && manualDetectHasMeat(detailDish.name);
                const catLower = (detailDish.cat ?? '').toLowerCase();
                const isDessert = detailCourseTiming === 2
                  || MANUAL_DESSERT_CATEGORY_KEYWORDS.some(k => catLower.includes(k));
                const isAlcoholic = detailWithAlcohol === true;

                return isDrink ? (
                  /* ─── SECCIÓN BEBIDAS ─── */
                  <>
                    {/* ¿Con o sin alcohol? */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">¿Con o sin alcohol?</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailWithAlcohol(true)}
                          className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${detailWithAlcohol === true ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          🍹 Con Alcohol
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailWithAlcohol(false)}
                          className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${detailWithAlcohol === false ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          🥤 Sin Alcohol
                        </button>
                      </div>
                    </div>

                    {/* Liga (solo si con alcohol) */}
                    {isAlcoholic && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">¿Con qué liga?</label>
                        <div className="grid grid-cols-2 gap-2">
                          {MANUAL_LIGA_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setDetailLiga(opt.value)}
                              className={`min-h-[44px] px-3 py-2 rounded-lg text-sm text-left transition-colors ${detailLiga === opt.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ¿Cuándo deseas tu bebida? */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">¿Cuándo deseas tu bebida?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'Before', label: '🥗 Con la entrada' },
                          { key: 'During', label: '🍖 Con el plato fuerte' },
                          { key: 'After',  label: '🍰 Con el postre' },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setDetailDrinkTiming(opt.key)}
                            className={`min-h-[44px] px-2 py-2 rounded-lg text-xs font-medium leading-tight text-center transition-colors ${detailDrinkTiming === opt.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notas para bebida */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
                      <textarea
                        value={detailNotes}
                        onChange={e => setDetailNotes(e.target.value)}
                        placeholder="Ej: Con hielo, sin hielo, temperatura..."
                        rows={2}
                        maxLength={512}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-gray-700"
                      />
                    </div>
                  </>
                ) : (
                  /* ─── SECCIÓN COMIDA ─── */
                  <>
                    {/* ¿Cuándo lo quieres servir? */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">¿Cuándo lo quieres servir?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {MANUAL_COURSE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDetailCourseTiming(opt.value)}
                            className={`flex flex-col items-center justify-center min-h-[44px] px-1.5 py-3 rounded-lg text-sm font-medium transition-colors ${detailCourseTiming === opt.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            <span className="text-xl mb-1">{opt.icon}</span>
                            <span className="font-semibold text-xs leading-tight text-center">{opt.label}</span>
                            <span className={`text-[11px] leading-tight mt-0.5 text-center ${detailCourseTiming === opt.value ? 'text-white/70' : 'text-gray-400'}`}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Configurador POR UNIDAD — toda la comida (entrada/plato fuerte/postre) */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-sm font-medium text-gray-700">{hasMeat ? 'Cocción por unidad' : 'Detalle por unidad'}</label>
                        {detailUnits.length > 1 && hasMeat && (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-400 mr-0.5">Todas:</span>
                            {MANUAL_COOKING_OPTIONS.map(opt => (
                              <button key={opt.key} type="button" onClick={() => applyCookingToAll(opt.key)}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 transition-colors">
                                {opt.short}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {detailUnits.map((u, i) => (
                          <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                            <div className="flex items-center gap-2 px-2.5 py-2">
                              <span className="text-[11px] font-bold text-gray-500 w-[52px] flex-shrink-0">Unidad {i + 1}</span>
                              <div className="flex-1">
                                {hasMeat ? (
                                  <div className="grid grid-cols-3 gap-1">
                                    {MANUAL_COOKING_OPTIONS.map(opt => (
                                      <button key={opt.key} type="button" onClick={() => setUnitField(i, 'meatCooking', opt.key)}
                                        className={`min-h-[40px] px-1 py-1 rounded-lg text-[11px] font-medium leading-tight transition-colors ${u.meatCooking === opt.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-gray-400">Toca ▸ para personalizar esta unidad</span>
                                )}
                              </div>
                              <button type="button" onClick={() => setExpandedUnit(expandedUnit === i ? null : i)}
                                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Más detalle de la unidad">
                                {expandedUnit === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                            {expandedUnit === i && (
                              <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-gray-100 bg-gray-50">
                                {!isDessert && (
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Guarnición</label>
                                    <select value={u.sideDish} onChange={e => setUnitField(i, 'sideDish', e.target.value)}
                                      className="w-full h-10 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700 bg-white">
                                      <option value="">Sin preferencia</option>
                                      <option value="Arroz">Arroz</option>
                                      <option value="Papas Fritas">Papas Fritas</option>
                                      <option value="Ensalada">Ensalada</option>
                                      <option value="Vegetales">Vegetales al Vapor</option>
                                      <option value="Puré">Puré de Papa</option>
                                    </select>
                                  </div>
                                )}
                                <div>
                                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Personalizaciones</label>
                                  <input type="text" value={u.customizations} onChange={e => setUnitField(i, 'customizations', e.target.value)}
                                    placeholder="Ej: sin cebolla, extra queso" maxLength={512}
                                    className="w-full h-10 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700" />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-orange-600 mb-1">¿Alergias?</label>
                                  <input type="text" value={u.allergies} onChange={e => setUnitField(i, 'allergies', e.target.value)}
                                    placeholder="Ej: mariscos, nueces" maxLength={512}
                                    className="w-full h-10 px-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50 text-gray-700" />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Notas</label>
                                  <input type="text" value={u.notes} onChange={e => setUnitField(i, 'notes', e.target.value)}
                                    placeholder="Ej: sin sal, extra salsa" maxLength={512}
                                    className="w-full h-10 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700" />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {detailUnits.length > 1 && (
                        <p className="text-[11px] text-gray-400 mt-2">Cada unidad va por separado a cocina con su preferencia.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Acciones — footer sticky siempre visible */}
            <div className="flex-shrink-0 flex gap-3 p-4 sm:p-5 border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={closeDetail}
                className="flex-1 min-h-[44px] px-4 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDetail}
                className="flex-1 min-h-[44px] px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors shadow-lg"
              >
                {editingLineId != null ? 'Guardar' : 'Agregar'} {detailQty > 1 ? `${detailQty} · ` : ''}RD$ {(detailDish.price * detailQty).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
