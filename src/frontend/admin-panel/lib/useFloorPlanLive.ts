'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import axios from 'axios';
import type { FloorPlanData, Reservation, ReservationStatus, StatusPaletteOverride, TableStatus } from '@smartmenu/ui';
import { ensureFreshToken } from '@/lib/api';

const api = axios.create({ baseURL: '' });

function authHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Estado backend (PascalCase) → estado del plano (@smartmenu/ui, minúscula). */
function toFloorStatus(s: string | null | undefined): TableStatus {
  return String(s ?? 'available').toLowerCase() as TableStatus;
}

/** Mesas sin posición guardada (layout aún no diseñado) → grilla automática por zona. */
function withAutoLayout(data: FloorPlanData): FloorPlanData {
  return {
    zones: data.zones.map((z) => {
      let i = 0;
      return {
        ...z,
        tables: z.tables.map((t) => {
          if (t.x != null && t.y != null) return t;
          const col = i % 4;
          const row = Math.floor(i / 4);
          i += 1;
          return { ...t, x: 90 + col * 150, y: 80 + row * 130 };
        }),
      };
    }),
  };
}

/** Normaliza la respuesta de /api/floorplan: status en minúscula + null→undefined en opcionales. */
function normalizeFloorPlan(raw: FloorPlanData): FloorPlanData {
  return withAutoLayout({
    zones: (raw.zones ?? []).map((z) => ({
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      structures: z.structures ?? [],
      tables: (z.tables ?? []).map((t) => ({
        ...t,
        status: toFloorStatus(t.status as unknown as string),
        shape: t.shape ?? undefined,
        width: t.width ?? undefined,
        height: t.height ?? undefined,
        server: t.server ?? undefined,
        name: t.name ?? undefined,
        color: t.color ?? undefined,
        waiter: t.waiter ?? undefined,
        waiterName: t.waiterName ?? undefined,
      })),
    })),
  });
}

const RES_STATUS_MAP: Record<string, ReservationStatus | undefined> = {
  Confirmed: 'Confirmado',
  Seated: 'Sentado',
  Pending: 'Esperando',
};

function mapReservations(raw: any[], zoneNameToId: Map<string, string>): Reservation[] {
  const out: Reservation[] = [];
  for (const r of raw) {
    const status = RES_STATUS_MAP[String(r.status ?? r.Status ?? '')];
    if (!status) continue; // ignorar Completed / NoShow / Cancelled / Expired
    const dt = r.reservationDateTime ?? r.ReservationDateTime;
    const time = dt
      ? new Date(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';
    const zoneName = r.zoneName ?? r.ZoneName ?? r.requestedZoneName ?? r.RequestedZoneName ?? '';
    const special = r.specialRequests ?? r.SpecialRequests;
    out.push({
      id: String(r.id ?? r.Id),
      zoneId: zoneNameToId.get(zoneName) ?? '',
      time,
      customerName: r.customerName ?? r.CustomerName ?? 'Reserva',
      partySize: r.numberOfGuests ?? r.NumberOfGuests ?? 0,
      status,
      tableId: r.tableId ?? r.TableId ?? r.tableNumber ?? r.TableNumber ?? '',
      phone: r.customerPhone ?? r.CustomerPhone ?? undefined,
      tags: special ? [String(special)] : undefined,
    });
  }
  return out;
}

/**
 * Conecta el plano de Gestión de Salón a datos reales:
 * - Layout: GET /api/floorplan (posiciones/formas/estructuras diseñadas; auto-grid si faltan).
 * - Estado en vivo: /hubs/tables (TableStatusChanged, instantáneo) + polling /api/table (~10s, reconcilia).
 * - Reservas de hoy: GET /api/tablereservation por zona, en vivo vía /hubs/reservations + poll (~20s).
 * - Guardado del editor: PUT /api/floorplan (debounced) desde onLayoutChange.
 */
export function useFloorPlanLive() {
  const [data, setData] = useState<FloorPlanData>({ zones: [] });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [palette, setPalette] = useState<StatusPaletteOverride | undefined>(undefined);
  const [hostEnabled, setHostEnabled] = useState(true);
  const [waiterEnabled, setWaiterEnabled] = useState(true);
  const zoneNameToId = useRef<Map<string, string>>(new Map());

  const loadFloorPlan = useCallback(async () => {
    try {
      const res = await api.get('/api/floorplan', { headers: authHeader() });
      const raw = (res.data ?? { zones: [] }) as FloorPlanData;
      const map = new Map<string, string>();
      (raw.zones ?? []).forEach((z) => map.set(z.zoneName, z.zoneId));
      zoneNameToId.current = map;
      setData(normalizeFloorPlan(raw));
      const cfg = res.data as { palette?: StatusPaletteOverride | null; hostEnabled?: boolean; waiterEnabled?: boolean };
      setPalette(cfg?.palette ?? undefined);
      setHostEnabled(cfg?.hostEnabled ?? true);
      setWaiterEnabled(cfg?.waiterEnabled ?? true);
    } catch {
      /* silencioso */
    }
  }, []);

  const loadReservations = useCallback(async () => {
    try {
      const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
      const res = await api.get(`/api/tablereservation?date=${today}`, { headers: authHeader() });
      const raw = Array.isArray(res.data) ? res.data : [];
      setReservations(mapReservations(raw, zoneNameToId.current));
    } catch {
      /* silencioso */
    }
  }, []);

  /** Polling de respaldo: reconciliar status desde /api/table (cubre el "Reserved" dinámico y eventos perdidos). */
  const reconcileStatuses = useCallback(async () => {
    try {
      const res = await api.get('/api/table', { headers: authHeader() });
      const raw = Array.isArray(res.data) ? res.data : [];
      const byId = new Map<number, string>();
      raw.forEach((t: any) => byId.set(Number(t.id ?? t.Id), String(t.status ?? t.Status ?? '')));
      setData((prev) => ({
        zones: prev.zones.map((z) => ({
          ...z,
          tables: z.tables.map((t) => {
            const s = byId.get(Number(t.id));
            return s ? { ...t, status: toFloorStatus(s) } : t;
          }),
        })),
      }));
    } catch {
      /* silencioso */
    }
  }, []);

  const applyTableStatus = useCallback((tableId: number, status: string) => {
    setData((prev) => ({
      zones: prev.zones.map((z) => ({
        ...z,
        tables: z.tables.map((t) => (Number(t.id) === tableId ? { ...t, status: toFloorStatus(status) } : t)),
      })),
    }));
  }, []);

  /** Overlay del MESERO a cargo (badge). null/undefined limpia el badge. */
  const applyTableWaiter = useCallback((tableId: number, waiter?: string | null, waiterName?: string | null) => {
    setData((prev) => ({
      zones: prev.zones.map((z) => ({
        ...z,
        tables: z.tables.map((t) =>
          Number(t.id) === tableId ? { ...t, waiter: waiter ?? undefined, waiterName: waiterName ?? undefined } : t
        ),
      })),
    }));
  }, []);

  // Carga inicial + polling
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadFloorPlan();
      if (alive) await loadReservations();
    })();
    // Polling de RESPALDO (60s). La vía principal es SignalR: TableStatusChanged (parche local)
    // para estado de mesa, y los eventos de reserva para refrescar el panel de reservas.
    const t1 = setInterval(reconcileStatuses, 60000);
    const t2 = setInterval(loadReservations, 60000);
    return () => {
      alive = false;
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [loadFloorPlan, loadReservations, reconcileStatuses]);

  // Tiempo real: mesas + reservas (mismo patrón que useAdminNotifications)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const mkConn = (path: string) =>
      new signalR.HubConnectionBuilder()
        .withUrl(`${window.location.origin}${path}`, {
          accessTokenFactory: () => ensureFreshToken(),
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    const tablesConn = mkConn('/hubs/tables');
    tablesConn.on('TableStatusChanged', (d: any) => {
      const id = Number(d?.tableId ?? d?.TableId);
      if (id) applyTableStatus(id, String(d?.status ?? d?.Status ?? ''));
    });
    tablesConn.on('TableWaiterChanged', (d: any) => {
      const id = Number(d?.tableId ?? d?.TableId);
      if (id) applyTableWaiter(id, d?.waiter ?? d?.Waiter ?? null, d?.waiterName ?? d?.WaiterName ?? null);
    });
    tablesConn.on('FloorPlanVisibilityChanged', (d: any) => {
      const h = d?.hostEnabled ?? d?.HostEnabled;
      const w = d?.waiterEnabled ?? d?.WaiterEnabled;
      if (typeof h === 'boolean') setHostEnabled(h);
      if (typeof w === 'boolean') setWaiterEnabled(w);
    });
    tablesConn.start().catch((e) => console.error('[admin] SignalR /hubs/tables connect failed', e));

    const resConn = mkConn('/hubs/reservations');
    // Solo refresca el PANEL de reservas (y el badge, que sale de `reservations`). El estado/color
    // de mesa NO se recarga aquí: llega por TableStatusChanged (/hubs/tables) → parche local.
    const refetch = () => loadReservations();
    resConn.on('NewReservation', refetch);
    resConn.on('ReservationConfirmed', refetch);
    resConn.on('ReservationCancelled', refetch);
    resConn.on('ReservationTableAssigned', refetch);
    resConn.on('ReservationSeated', refetch);
    resConn.start().catch((e) => console.error('[admin] SignalR /hubs/reservations connect failed', e));

    return () => {
      tablesConn.stop().catch(() => {});
      resConn.stop().catch(() => {});
    };
  }, [applyTableStatus, applyTableWaiter, loadReservations, loadFloorPlan]);

  // Guardado del editor (debounced) → PUT /api/floorplan
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLayoutChange = useCallback((next: FloorPlanData) => {
    setData(next); // optimista
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put('/api/floorplan', next, { headers: authHeader() }).catch(() => {});
    }, 800);
  }, []);

  // Guardado de la paleta (debounced) → PUT /api/floorplan/palette
  const paletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPaletteChange = useCallback((next: StatusPaletteOverride) => {
    setPalette(next); // optimista
    if (paletteTimer.current) clearTimeout(paletteTimer.current);
    paletteTimer.current = setTimeout(() => {
      api.put('/api/floorplan/palette', { statusColors: next }, { headers: authHeader() }).catch(() => {});
    }, 500);
  }, []);

  // Limpieza al desmontar: cancela los PUT debounced pendientes (editor y paleta)
  // para que no se disparen después del unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (paletteTimer.current) clearTimeout(paletteTimer.current);
    };
  }, []);

  // Switch de visibilidad del plano por app (Host/Mesero) → PUT /api/floorplan/visibility.
  // El backend difunde FloorPlanVisibilityChanged para que host/waiter reaccionen en vivo.
  const onToggleVisibility = useCallback((target: 'host' | 'waiter', enabled: boolean) => {
    if (target === 'host') setHostEnabled(enabled);
    else setWaiterEnabled(enabled);
    const body = target === 'host' ? { host: enabled } : { waiter: enabled };
    api.put('/api/floorplan/visibility', body, { headers: authHeader() }).catch(() => {});
  }, []);

  return { data, reservations, palette, hostEnabled, waiterEnabled, onLayoutChange, onPaletteChange, onToggleVisibility };
}
