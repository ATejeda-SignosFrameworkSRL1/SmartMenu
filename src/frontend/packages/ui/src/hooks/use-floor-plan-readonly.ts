'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import type { FloorPlanData, TableStatus } from '../components/floor-plan/types';
import type { StatusPaletteOverride } from '../components/floor-plan/status-colors';

export interface FloorPlanTableEvent {
  tableId: number;
  status?: string;
  waiter?: string | null;
  waiterName?: string | null;
}

export interface FloorPlanReadOnlyOptions {

  tokenKey: string;

  getAccessToken: () => Promise<string> | string;

  fetchFloorPlan: () => Promise<unknown>;

  enabledField: 'waiterEnabled' | 'hostEnabled';

  logTag?: string;

  onTableEvent?: (e: FloorPlanTableEvent) => void;
}

function toFloorStatus(s: string | null | undefined): TableStatus {
  return String(s ?? 'available').toLowerCase() as TableStatus;
}

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

export function useFloorPlanReadOnly(options: FloorPlanReadOnlyOptions) {
  const [data, setData] = useState<FloorPlanData>({ zones: [] });
  const [palette, setPalette] = useState<StatusPaletteOverride | undefined>(undefined);
  const [enabled, setEnabled] = useState(true);

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

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { tokenKey, enabledField, logTag } = optsRef.current;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

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
