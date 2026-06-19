"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  Check,
  Clock,
  LayoutGrid,
  type LucideIcon,
  Monitor,
  Radio,
  Send,
  Smartphone,
} from "lucide-react";

import { FloorPlanDashboard, type Reservation } from "./floor-plan-dashboard";
import type { FloorPlanData } from "./types";
import type { StatusPaletteOverride } from "./status-colors";

/** App destino al publicar el plano. */
export type ExportTarget = "host" | "waiter" | "all";

export interface FloorPlanModuleProps {
  data: FloorPlanData;
  reservations: Reservation[];
  /** Cambios de layout en Modo Diseñador (drag de mesas/estructuras). */
  onDataChange?: (data: FloorPlanData) => void;
  /** Publicar el plano a una app destino (Host / Mesero / ambas). */
  onExport?: (target: ExportTarget) => void;
  /** Última publicación, ej. "hace 5 min". */
  lastPublished?: string;
  /** Alto del dashboard interno en px. Default 620. */
  dashboardHeight?: number;
  /** Paleta de estados (override por restaurante). */
  palette?: StatusPaletteOverride;
  /** Guardar la paleta editada (Diseñador → editor de colores). */
  onPaletteChange?: (palette: StatusPaletteOverride) => void;
}

const BRAND = "#8a0000";

/** "11:30 AM" → minutos desde medianoche (para ordenar la próxima reserva). */
function timeToMinutes(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 24 * 60;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

/**
 * Módulo "Plano de Planta" tal como viviría dentro del admin-panel (debajo del
 * Header de la app): tira de KPIs + barra de publicación —exportar la
 * distribución a Host y Mesero— sobre el `FloorPlanDashboard` multi-zona.
 *
 * En producción `onExport` haría POST del layout al backend, que lo difunde por
 * SignalR a host/waiter; aquí refleja el estado de sincronización visualmente.
 */
export function FloorPlanModule({
  data,
  reservations,
  onDataChange,
  onExport,
  lastPublished,
  dashboardHeight = 620,
  palette,
  onPaletteChange,
}: FloorPlanModuleProps) {
  const [synced, setSynced] = useState<{ host: boolean; waiter: boolean }>({ host: false, waiter: false });
  const [lastSync, setLastSync] = useState<string | undefined>(lastPublished);

  const publish = (target: ExportTarget) => {
    setSynced((s) => ({
      host: target === "waiter" ? s.host : true,
      waiter: target === "host" ? s.waiter : true,
    }));
    setLastSync("hace un momento");
    onExport?.(target);
  };

  // ── KPIs (resumen global de todas las zonas) ──
  const stats = useMemo(() => {
    const tables = data.zones.flatMap((z) => z.tables);
    const total = tables.length;
    const occupied = tables.filter((t) => t.status === "occupied" || t.status === "billing").length;
    const reserved = tables.filter((t) => t.status === "reserved").length;
    const pct = total ? Math.round((occupied / total) * 100) : 0;
    const guests = reservations.reduce((n, r) => n + r.partySize, 0);
    const next = [...reservations].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))[0];
    return { total, occupied, reserved, pct, zones: data.zones.length, resCount: reservations.length, guests, next };
  }, [data, reservations]);

  const kpis = [
    { key: "mesas", label: "Mesas", value: String(stats.total), sub: `${stats.zones} zonas · ${stats.reserved} reservadas`, Icon: LayoutGrid, bar: null as number | null },
    { key: "ocup", label: "Ocupación", value: `${stats.pct}%`, sub: `${stats.occupied} de ${stats.total} ocupadas`, Icon: Activity, bar: stats.pct },
    { key: "res", label: "Reservas hoy", value: String(stats.resCount), sub: `${stats.guests} comensales`, Icon: CalendarClock, bar: null },
    {
      key: "next",
      label: "Próxima reserva",
      value: stats.next?.time ?? "—",
      sub: stats.next ? `${stats.next.customerName} · ${stats.next.tableId}` : "Sin reservas",
      Icon: Clock,
      bar: null,
    },
  ];

  const bothSynced = synced.host && synced.waiter;
  const anySynced = synced.host || synced.waiter;

  const stateLabel = bothSynced ? "Publicado" : anySynced ? "Parcial" : "Borrador";
  const stateClass = bothSynced
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";
  const stateDot = bothSynced ? "bg-emerald-500" : "bg-amber-500";
  const lastLine = lastSync ? `Última publicación: ${lastSync} · Admin System` : "Aún sin publicar";

  /** Indicador-acción por canal: muestra estado de sincronización y publica al hacer clic. */
  const channelChip = (label: string, Icon: LucideIcon, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      title={active ? `${label}: sincronizado` : `Publicar a ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {active ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ key, label, value, sub, Icon, bar }) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <Icon className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-1.5 text-2xl font-bold leading-none text-slate-900">{value}</p>
            {bar != null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${bar}%`, backgroundColor: BRAND }} />
              </div>
            )}
            <p className="mt-1.5 truncate text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Barra de publicación ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${BRAND}14`, color: BRAND }}
          >
            <Radio className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Publicación al salón</p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${stateClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${stateDot}`} />
                {stateLabel}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{lastLine}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            {channelChip("Host", Monitor, synced.host, () => publish("host"))}
            {channelChip("Mesero", Smartphone, synced.waiter, () => publish("waiter"))}
          </div>
          <span className="hidden h-8 w-px bg-slate-200 sm:block" />
          <button
            type="button"
            onClick={() => publish("all")}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: BRAND }}
          >
            <Send className="h-4 w-4" />
            Publicar a todos
          </button>
        </div>
      </div>

      {/* ── Dashboard multi-zona ── */}
      <FloorPlanDashboard
        data={data}
        reservations={reservations}
        onDataChange={onDataChange}
        height={dashboardHeight}
        palette={palette}
        onPaletteChange={onPaletteChange}
      />
    </div>
  );
}
