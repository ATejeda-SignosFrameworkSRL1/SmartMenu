'use client';

// DEDUP-FLOORPLAN.1 — Hook COMPARTIDO del plano de salon en SOLO LECTURA.
// Antes vivia copiado ~95% identico en waiter-app/lib/useWaiterFloorPlan.ts y
// host-app/lib/useHostFloorPlan.ts (y ya habian divergido en detalles). Esta es
// la unica fuente; cada app lo envuelve inyectando su cliente API, su token y
// su campo de visibilidad.
//
// REGLAS DE ORO (no tocar sin leer Documentations/Arquitectura-actual-del-sistema-de-tiempo-real.md):
// - La via PRINCIPAL es SignalR /hubs/tables (TableStatusChanged/TableWaiterChanged
//   -> parche local). El poll de 60s es RESPALDO intencional: cubre eventos perdidos,
//   SignalR caido y el flip por TIEMPO de las reservas (que no tiene push). NO quitarlo.
// - withAutomaticReconnect([0,2000,5000,10000,30000]) es la politica estandar del stack.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import type { FloorPlanData, TableStatus } from '../components/floor-plan/types';
import type { StatusPaletteOverride } from '../components/floor-plan/status-colors';

/** Evento crudo de /hubs/tables que se re-expone a la app (la grilla del waiter lo consume). */
export interface FloorPlanTableEvent {
  tableId: number;
  status?: string;
  waiter?: string | null;
  waiterName?: string | null;
}

export interface FloorPlanReadOnlyOptions {
  /** Clave del JWT en localStorage (ej. 'waiter_token'). Sin token no se abre SignalR. */
  tokenKey: string;
  /** Devuelve un JWT fresco para el accessTokenFactory de SignalR. */
  getAccessToken: () => Promise<string> | string;
  /** GET /api/floorplan de la app; debe resolver con el payload (res.data). */
  fetchFloorPlan: () => Promise<unknown>;
  /** Campo del payload/evento que habilita el plano para esta app. */
  enabledField: 'waiterEnabled' | 'hostEnabled';
  /** Prefijo de los logs de conexion (ej. 'waiter'). */
  logTag?: string;
  /** Callback por cada evento de /hubs/tables (opcional). */
  onTableEvent?: (e: FloorPlanTableEvent) => void;
}

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
 * Plano de salón en SOLO LECTURA: GET /api/floorplan (layout + estado + colores +
 * mesero) con overlay en vivo por /hubs/tables. Sin edición (no PUT).
 */
export function useFloorPlanReadOnly(options: FloorPlanReadOnlyOptions) {
  const [data, setData] = useState<FloorPlanData>({ zones: [] });
  const [palette, setPalette] = useState<StatusPaletteOverride | undefined>(undefined);
  const [enabled, setEnabled] = useState(true);

  // Las opciones viven en un ref siempre fresco: los efectos corren UNA sola vez
  // (montaje) y no re-crean la conexión SignalR cuando el caller re-renderiza.
  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  const load = useCallback(async () => {
    try {
      const payload = ((await optsRef.current.fetchFloorPlan()) ?? { zones: [] }) as FloorPlanData & {
        palette?: StatusPaletteOverride | null;
      } & Record<string, unknown>;
      setData(normalize(payload));
      setPalette(payload.palette ?? undefined);
      const flag = payload[optsRef.current.enabledField];
      setEnabled(typeof flag === 'boolean' ? flag : true);
    } catch {
      /* silencioso — el proximo poll/evento reconcilia */
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

  // Carga inicial + reconcile de RESPALDO cada 60s (ver nota de reglas de oro arriba).
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Tiempo real: estado + mesero por /hubs/tables.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { tokenKey, enabledField, logTag } = optsRef.current;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    // 'waiterEnabled' -> 'WaiterEnabled' (el hub emite PascalCase o camelCase).
    const enabledFieldPascal = enabledField.charAt(0).toUpperCase() + enabledField.slice(1);

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${window.location.origin}/hubs/tables`, {
        accessTokenFactory: () => Promise.resolve(optsRef.current.getAccessToken()),
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    conn.on('TableStatusChanged', (d: any) => {
      const id = Number(d?.tableId ?? d?.TableId);
      if (!id) return;
      const status = String(d?.status ?? d?.Status ?? '');
      applyStatus(id, status);
      optsRef.current.onTableEvent?.({ tableId: id, status });
    });
    conn.on('TableWaiterChanged', (d: any) => {
      const id = Number(d?.tableId ?? d?.TableId);
      if (!id) return;
      const waiter = d?.waiter ?? d?.Waiter ?? null;
      const waiterName = d?.waiterName ?? d?.WaiterName ?? null;
      applyWaiter(id, waiter, waiterName);
      optsRef.current.onTableEvent?.({ tableId: id, waiter, waiterName });
    });
    conn.on('FloorPlanVisibilityChanged', (d: any) => {
      const flag = d?.[enabledField] ?? d?.[enabledFieldPascal];
      if (typeof flag === 'boolean') setEnabled(flag);
    });
    conn.start().catch((e) => console.error(`[${logTag ?? 'floor-plan'}] SignalR /hubs/tables connect failed`, e));

    return () => {
      conn.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyStatus, applyWaiter]);

  return { data, palette, enabled, reload: load };
}
