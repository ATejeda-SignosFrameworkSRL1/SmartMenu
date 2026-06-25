'use client';

import { useCallback, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { createAuthApi, ensureFreshToken } from '@/lib/auth-client';
import type { FloorPlanData, StatusPaletteOverride, TableStatus } from '@smartmenu/ui';

const { api } = createAuthApi('host');

/** Estado backend (PascalCase) → estado del plano (@smartmenu/ui, minúscula). */
function toFloorStatus(s: string | null | undefined): TableStatus {
  return String(s ?? 'available').toLowerCase() as TableStatus;
}

/** Mesas sin posición guardada → grilla automática por zona (hasta que el admin diseñe). */
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

function normalize(raw: FloorPlanData): FloorPlanData {
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
        name: t.name ?? undefined,
        color: t.color ?? undefined,
        waiter: t.waiter ?? undefined,
        waiterName: t.waiterName ?? undefined,
      })),
    })),
  });
}

/**
 * Plano de salón en SOLO LECTURA para el host-app: GET /api/floorplan (layout +
 * estado + colores) con overlay en vivo por /hubs/tables (TableStatusChanged +
 * TableWaiterChanged). Sin edición. Espejo de waiter/useWaiterFloorPlan.
 */
export function useHostFloorPlan() {
  const [data, setData] = useState<FloorPlanData>({ zones: [] });
  const [palette, setPalette] = useState<StatusPaletteOverride | undefined>(undefined);
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/floorplan');
      const raw = (res.data ?? { zones: [] }) as FloorPlanData;
      setData(normalize(raw));
      const cfg = res.data as { palette?: StatusPaletteOverride | null; hostEnabled?: boolean };
      setPalette(cfg?.palette ?? undefined);
      setEnabled(cfg?.hostEnabled ?? true);
    } catch {
      /* silencioso */
    }
  }, []);

  const applyStatus = useCallback((tableId: number, status: string) => {
    setData((prev) => ({
      zones: prev.zones.map((z) => ({
        ...z,
        tables: z.tables.map((t) => (Number(t.id) === tableId ? { ...t, status: toFloorStatus(status) } : t)),
      })),
    }));
  }, []);

  const applyWaiter = useCallback((tableId: number, waiter?: string | null, waiterName?: string | null) => {
    setData((prev) => ({
      zones: prev.zones.map((z) => ({
        ...z,
        tables: z.tables.map((t) =>
          Number(t.id) === tableId ? { ...t, waiter: waiter ?? undefined, waiterName: waiterName ?? undefined } : t
        ),
      })),
    }));
  }, []);

  // Carga inicial + reconcile de respaldo cada 15s.
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Tiempo real: estado + mesero por /hubs/tables.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('host_token');
    if (!token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${window.location.origin}/hubs/tables`, {
        accessTokenFactory: () => ensureFreshToken('host'),
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    conn.on('TableStatusChanged', (d: any) => {
      const id = Number(d?.tableId ?? d?.TableId);
      if (id) applyStatus(id, String(d?.status ?? d?.Status ?? ''));
    });
    conn.on('TableWaiterChanged', (d: any) => {
      const id = Number(d?.tableId ?? d?.TableId);
      if (id) applyWaiter(id, d?.waiter ?? d?.Waiter ?? null, d?.waiterName ?? d?.WaiterName ?? null);
    });
    conn.on('FloorPlanVisibilityChanged', (d: any) => {
      const h = d?.hostEnabled ?? d?.HostEnabled;
      if (typeof h === 'boolean') setEnabled(h);
    });
    conn.start().catch((e) => console.error('[host] SignalR /hubs/tables connect failed', e));

    return () => {
      conn.stop().catch(() => {});
    };
  }, [applyStatus, applyWaiter]);

  return { data, palette, enabled, reload: load };
}
