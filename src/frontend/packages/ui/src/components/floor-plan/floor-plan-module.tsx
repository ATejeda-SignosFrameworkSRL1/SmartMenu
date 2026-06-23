"use client";

import { useMemo } from "react";
import {
  Activity,
  CalendarClock,
  Clock,
  LayoutGrid,
  type LucideIcon,
  Monitor,
  Radio,
  Smartphone,
} from "lucide-react";

import { FloorPlanDashboard, type FloorPlanDashboardMessages, type Reservation } from "./floor-plan-dashboard";
import type { FloorPlanData } from "./types";
import type { StatusLabels, StatusPaletteOverride } from "./status-colors";

/**
 * All hardcoded Spanish UI strings rendered by FloorPlanModule itself
 * (KPI cards + publication bar). Does NOT include FloorPlanDashboard strings —
 * pass those separately via the `dashboardMessages` prop.
 */
export interface FloorPlanModuleMessages {
  /** KPI card label. Default: "Mesas" */
  kpiTables: string;
  /** KPI card label. Default: "Ocupación" */
  kpiOccupancy: string;
  /** KPI card label. Default: "Reservas hoy" */
  kpiReservations: string;
  /** KPI card label. Default: "Próxima reserva" */
  kpiNextReservation: string;
  /** Sub-line for Mesas KPI. `(zones, reserved) => string` */
  tablesSub: (zones: number, reserved: number) => string;
  /** Sub-line for Ocupación KPI. `(occupied, total) => string` */
  occupancySub: (occupied: number, total: number) => string;
  /** Sub-line for Reservas hoy KPI. `(guests) => string` */
  reservationsSub: (guests: number) => string;
  /** Sub-line for Próxima reserva KPI. `(customerName, tableId) => string` */
  nextSub: (customerName: string, tableId: string | number) => string;
  /** Sub-line when there is no next reservation. Default: "Sin reservas" */
  noReservations: string;
  /** Publication badge: both channels on. Default: "Visible" */
  stateVisible: string;
  /** Publication badge: one channel on. Default: "Parcial" */
  statePartial: string;
  /** Publication badge: both channels off. Default: "Oculto" */
  stateHidden: string;
  /** Publication bar heading. Default: "Publicación al salón" */
  publishTitle: string;
  /** Publication bar hint. Default: "Activa cada switch para mostrar el plano en su app" */
  publishHint: string;
  /** Channel switch label for host-app. Default: "Host" */
  channelHost: string;
  /** Channel switch label for waiter-app. Default: "Mesero" */
  channelWaiter: string;
  /** aria-label for the channel toggle switch. `(show, label) => string` */
  switchAria: (show: boolean, label: string) => string;
  /** title when switch is ON. `(label) => string` */
  switchTitleOn: (label: string) => string;
  /** title when switch is OFF. `(label) => string` */
  switchTitleOff: (label: string) => string;
}

export const defaultFloorPlanModuleMessages: FloorPlanModuleMessages = {
  kpiTables: "Mesas",
  kpiOccupancy: "Ocupación",
  kpiReservations: "Reservas hoy",
  kpiNextReservation: "Próxima reserva",
  tablesSub: (zones, reserved) => `${zones} zonas · ${reserved} reservadas`,
  occupancySub: (occupied, total) => `${occupied} de ${total} ocupadas`,
  reservationsSub: (guests) => `${guests} comensales`,
  nextSub: (customerName, tableId) => `${customerName} · ${tableId}`,
  noReservations: "Sin reservas",
  stateVisible: "Visible",
  statePartial: "Parcial",
  stateHidden: "Oculto",
  publishTitle: "Publicación al salón",
  publishHint: "Activa cada switch para mostrar el plano en su app",
  channelHost: "Host",
  channelWaiter: "Mesero",
  switchAria: (show, label) => `${show ? "Ocultar" : "Mostrar"} el plano en ${label}`,
  switchTitleOn: (label) => `Plano visible en ${label}`,
  switchTitleOff: (label) => `Plano oculto en ${label}`,
};

/** Canal (app) cuyo plano se muestra/oculta con el switch. */
export type FloorPlanChannel = "host" | "waiter";

export interface FloorPlanModuleProps {
  data: FloorPlanData;
  reservations: Reservation[];
  /** Cambios de layout en Modo Diseñador (drag de mesas/estructuras). */
  onDataChange?: (data: FloorPlanData) => void;
  /** Visibilidad del plano en la host-app (switch del admin). Default true. */
  hostEnabled?: boolean;
  /** Visibilidad del plano en la waiter-app (switch del admin). Default true. */
  waiterEnabled?: boolean;
  /** Encender/apagar el plano de un canal (host/waiter) → reflejo en su app. */
  onToggleChannel?: (target: FloorPlanChannel, enabled: boolean) => void;
  /** Alto del dashboard interno en px. Default 620. */
  dashboardHeight?: number;
  /** Paleta de estados (override por restaurante). */
  palette?: StatusPaletteOverride;
  /** Guardar la paleta editada (Diseñador → editor de colores). */
  onPaletteChange?: (palette: StatusPaletteOverride) => void;
  /** Translated UI strings for the module's own KPIs and publication bar. Missing keys fall back to Spanish. */
  messages?: Partial<FloorPlanModuleMessages>;
  /** Translated UI strings forwarded to FloorPlanDashboard. Missing keys fall back to Spanish. */
  dashboardMessages?: Partial<FloorPlanDashboardMessages>;
  /** Translated status labels forwarded to FloorPlanDashboard. Missing keys fall back to Spanish. */
  statusLabels?: Partial<StatusLabels>;
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
 * Módulo "Plano de Planta" del admin-panel (debajo del Header): tira de KPIs +
 * barra de visibilidad —switches Host / Mesero que muestran u ocultan el plano en
 * cada app— sobre el `FloorPlanDashboard` multi-zona.
 *
 * `onToggleChannel` persiste el switch en el backend (PUT /api/floorplan/visibility),
 * que difunde `FloorPlanVisibilityChanged` por SignalR para reflejo en vivo en host/waiter.
 */
export function FloorPlanModule({
  data,
  reservations,
  onDataChange,
  hostEnabled = true,
  waiterEnabled = true,
  onToggleChannel,
  dashboardHeight = 620,
  palette,
  onPaletteChange,
  messages,
  dashboardMessages,
  statusLabels,
}: FloorPlanModuleProps) {
  const msg: FloorPlanModuleMessages = { ...defaultFloorPlanModuleMessages, ...messages };

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
    { key: "mesas", label: msg.kpiTables, value: String(stats.total), sub: msg.tablesSub(stats.zones, stats.reserved), Icon: LayoutGrid, bar: null as number | null },
    { key: "ocup", label: msg.kpiOccupancy, value: `${stats.pct}%`, sub: msg.occupancySub(stats.occupied, stats.total), Icon: Activity, bar: stats.pct },
    { key: "res", label: msg.kpiReservations, value: String(stats.resCount), sub: msg.reservationsSub(stats.guests), Icon: CalendarClock, bar: null },
    {
      key: "next",
      label: msg.kpiNextReservation,
      value: stats.next?.time ?? "—",
      sub: stats.next ? msg.nextSub(stats.next.customerName, stats.next.tableId) : msg.noReservations,
      Icon: Clock,
      bar: null,
    },
  ];

  const bothOn = hostEnabled && waiterEnabled;
  const anyOn = hostEnabled || waiterEnabled;

  const stateLabel = bothOn ? msg.stateVisible : anyOn ? msg.statePartial : msg.stateHidden;
  const stateClass = bothOn
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : anyOn
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-100 text-slate-500 ring-slate-200";
  const stateDot = bothOn ? "bg-emerald-500" : anyOn ? "bg-amber-500" : "bg-slate-400";
  const lastLine = msg.publishHint;

  /** Switch por canal: enciende/apaga la visibilidad del plano en esa app (reflejo en vivo). */
  const channelSwitch = (label: string, Icon: LucideIcon, on: boolean, target: FloorPlanChannel) => (
    <div className="inline-flex items-center gap-2">
      <Icon className={`h-4 w-4 ${on ? "text-slate-700" : "text-slate-400"}`} />
      <span className={`text-sm font-medium ${on ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={msg.switchAria(on, label)}
        title={on ? msg.switchTitleOn(label) : msg.switchTitleOff(label)}
        onClick={() => onToggleChannel?.(target, !on)}
        className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors"
        style={{ backgroundColor: on ? BRAND : "#cbd5e1" }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
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
              <p className="text-sm font-semibold text-slate-800">{msg.publishTitle}</p>
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

        <div className="flex items-center gap-4">
          {channelSwitch(msg.channelHost, Monitor, hostEnabled, "host")}
          <span className="h-8 w-px bg-slate-200" />
          {channelSwitch(msg.channelWaiter, Smartphone, waiterEnabled, "waiter")}
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
        statusLabels={statusLabels}
        messages={dashboardMessages}
      />
    </div>
  );
}
