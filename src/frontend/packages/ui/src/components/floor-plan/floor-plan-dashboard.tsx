"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Inbox, Palette, Pencil, Phone, Search, Users } from "lucide-react";

import { MultiZoneFloorPlanViewer } from "./multi-zone-floor-plan-viewer";
import { MultiZoneFloorPlanEditor } from "./multi-zone-floor-plan-editor";
import { resolveStatusColors, resolveStatusLabels, type StatusLabels, type StatusPaletteOverride } from "./status-colors";
import type { FloorPlanData, TableStatus } from "./types";

export interface FloorPlanDashboardMessages {

  canvasTitle: string;

  modeLive: string;

  modeDesigner: string;

  paletteButton: string;

  paletteReset: string;

  reservationsTitle: string;

  reservationsSummary: (zoneName: string, count: number, guests: number) => string;

  searchPlaceholder: string;

  newButton: string;

  emptyZoneTitle: string;

  emptyZoneSub: string;

  emptySearchTitle: string;

  emptySearchSub: string;

  tablePrefix: string;
}

const DEFAULT_DASHBOARD_MESSAGES: FloorPlanDashboardMessages = {
  canvasTitle: "Plano de planta",
  modeLive: "En Vivo",
  modeDesigner: "Diseñador",
  paletteButton: "Colores",
  paletteReset: "Restablecer",
  reservationsTitle: "Reservaciones",
  reservationsSummary: (zoneName, count, guests) =>
    `${zoneName} · ${count} ${count === 1 ? "reserva" : "reservas"} · ${guests} comensales`,
  searchPlaceholder: "Buscar reserva…",
  newButton: "Nueva",
  emptyZoneTitle: "Sin reservaciones en esta zona",
  emptyZoneSub: "Las nuevas reservas aparecerán aquí",
  emptySearchTitle: "Sin resultados",
  emptySearchSub: "Probá con otro nombre o mesa",
  tablePrefix: "Mesa",
};

const AVATAR_COLORS = ["#5B61C9", "#3F88C5", "#2F9E78", "#D89A3C", "#D8565C", "#8B79C9", "#C56B9B", "#3E9A93"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const LEGEND_STATUSES: TableStatus[] = ["available", "occupied", "reserved", "billing", "cleaning", "empty"];

export type ReservationStatus = "Confirmado" | "Sentado" | "Esperando";

export interface Reservation {
  id: string;

  zoneId: string;

  time: string;
  customerName: string;
  partySize: number;
  status: ReservationStatus;

  tableId: string | number;

  phone?: string;

  tags?: string[];
}

export interface FloorPlanDashboardProps {
  data: FloorPlanData;
  reservations: Reservation[];

  onDataChange?: (data: FloorPlanData) => void;

  height?: number;

  palette?: StatusPaletteOverride;

  onPaletteChange?: (palette: StatusPaletteOverride) => void;

  statusLabels?: Partial<StatusLabels>;

  messages?: Partial<FloorPlanDashboardMessages>;
}

const STATUS_BADGE: Record<ReservationStatus, string> = {
  Confirmado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Sentado: "bg-blue-50 text-blue-700 ring-blue-200",
  Esperando: "bg-amber-50 text-amber-700 ring-amber-200",
};

const STATUS_ACCENT: Record<ReservationStatus, string> = {
  Confirmado: "#10B981",
  Sentado: "#3B82F6",
  Esperando: "#F59E0B",
};

export function FloorPlanDashboard({ data, reservations, onDataChange, height = 750, palette, onPaletteChange, statusLabels, messages }: FloorPlanDashboardProps) {
  const colors = resolveStatusColors(palette);
  const labels = resolveStatusLabels(statusLabels);
  const msg: FloorPlanDashboardMessages = { ...DEFAULT_DASHBOARD_MESSAGES, ...messages };
  const [mode, setMode] = useState<"live" | "designer">("live");
  const [activeZoneId, setActiveZoneId] = useState(data.zones[0]?.zoneId ?? "");
  const [selectedTableId, setSelectedTableId] = useState<string | number | null>(null);
  const [query, setQuery] = useState("");
  const [showPalette, setShowPalette] = useState(false);

  const handleZoneChange = (id: string) => {
    setActiveZoneId(id);
    setSelectedTableId(null);
  };

  const activeZoneName = data.zones.find((z) => z.zoneId === activeZoneId)?.zoneName ?? "";

  const { groups, count, guests, zoneTotal } = useMemo(() => {
    const inZone = reservations.filter((r) => r.zoneId === activeZoneId);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? inZone.filter(
          (r) =>
            r.customerName.toLowerCase().includes(q) ||
            String(r.tableId).toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q),
        )
      : inZone;
    const map = new Map<string, Reservation[]>();
    for (const r of filtered) {
      const list = map.get(r.time) ?? [];
      list.push(r);
      map.set(r.time, list);
    }
    return {
      groups: Array.from(map.entries()),
      count: filtered.length,
      guests: filtered.reduce((n, r) => n + r.partySize, 0),
      zoneTotal: inZone.length,
    };
  }, [reservations, activeZoneId, query]);

  const liveData = useMemo<FloorPlanData>(() => {
    const reservedIds = new Set(reservations.map((r) => String(r.tableId)));
    if (reservedIds.size === 0) return data;
    return {
      ...data,
      zones: data.zones.map((z) => ({
        ...z,
        tables: z.tables.map((t) => (reservedIds.has(String(t.id)) ? { ...t, hasReservation: true } : t)),
      })),
    };
  }, [data, reservations]);

  const modeBtn = (active: boolean) =>
    `rounded-md px-3 py-1 font-medium transition ${
      active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div
      className="flex w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900"
      style={{ height }}
    >

      <div className="flex w-[70%] flex-col">
        <div className="border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">{msg.canvasTitle}</h2>
            <div className="flex items-center gap-2">
              {mode === "designer" && onPaletteChange && (
                <button
                  type="button"
                  onClick={() => setShowPalette((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium transition ${
                    showPalette
                      ? "border-slate-300 bg-slate-100 text-slate-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" /> {msg.paletteButton}
                </button>
              )}
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
                <button type="button" onClick={() => setMode("live")} className={modeBtn(mode === "live")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {msg.modeLive}
                  </span>
                </button>
                <button type="button" onClick={() => setMode("designer")} className={modeBtn(mode === "designer")}>
                  <span className="inline-flex items-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    {msg.modeDesigner}
                  </span>
                </button>
              </div>
            </div>
          </div>
          {showPalette && mode === "designer" && onPaletteChange && (
            <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
              {LEGEND_STATUSES.map((s) => (
                <label key={s} className="flex flex-col items-center gap-1 text-[11px] text-slate-500">
                  <input
                    type="color"
                    value={colors[s].fill}
                    onChange={(e) => onPaletteChange({ ...(palette ?? {}), [s]: e.target.value })}
                    className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                  />
                  {labels[s]}
                </label>
              ))}
              <button
                type="button"
                onClick={() => onPaletteChange({})}
                className="ml-auto self-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                {msg.paletteReset}
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 p-4">
          {mode === "live" ? (
            <MultiZoneFloorPlanViewer
              data={liveData}
              fill
              fitToContent
              defaultZoneId={activeZoneId}
              onZoneChange={handleZoneChange}
              selectedTableId={selectedTableId ?? undefined}
              onTableClick={(id) => setSelectedTableId(id)}
              palette={palette}
            />
          ) : (
            <MultiZoneFloorPlanEditor
              data={data}
              fill
              fitToContent
              defaultZoneId={activeZoneId}
              onZoneChange={handleZoneChange}
              onChange={onDataChange}
              palette={palette}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50/70 px-4 py-2">
          {LEGEND_STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: colors[s].fill,
                  border: colors[s].dash
                    ? `1px dashed ${colors[s].stroke}`
                    : `1px solid ${colors[s].stroke}`,
                }}
              />
              {labels[s]}
            </span>
          ))}
        </div>
      </div>

      <aside className="flex w-[30%] flex-col border-l border-slate-200 bg-slate-50">
        <div className="space-y-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{msg.reservationsTitle}</h3>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <Users className="h-3.5 w-3.5" /> {guests}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {msg.reservationsSummary(activeZoneName, count, guests)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={msg.searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <button
              type="button"
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              {msg.newButton}
            </button>
          </div>
        </div>

        <div className="h-full space-y-5 overflow-y-auto p-4">
          {count === 0 ? (
            <div className="mt-10 flex flex-col items-center text-center text-slate-400">
              <Inbox className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm font-medium text-slate-500">
                {zoneTotal === 0 ? msg.emptyZoneTitle : msg.emptySearchTitle}
              </p>
              <p className="mt-0.5 text-xs">
                {zoneTotal === 0 ? msg.emptyZoneSub : msg.emptySearchSub}
              </p>
            </div>
          ) : (
            groups.map(([time, items]) => (
              <div key={time}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{time}</span>
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {items.length}
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="space-y-2">
                  {items.map((r) => {
                    const selected = r.tableId === selectedTableId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedTableId(r.tableId)}
                        className={`flex w-full items-stretch overflow-hidden rounded-xl border bg-white text-left transition ${
                          selected
                            ? "border-blue-400 ring-2 ring-blue-200"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <span className="w-1 flex-shrink-0" style={{ backgroundColor: STATUS_ACCENT[r.status] }} />
                        <span className="flex min-w-0 flex-1 items-start gap-2.5 p-2.5">
                          <span
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: avatarColor(r.customerName) }}
                          >
                            {initials(r.customerName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-slate-800">{r.customerName}</span>
                              <span
                                className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${STATUS_BADGE[r.status]}`}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: STATUS_ACCENT[r.status] }}
                                />
                                {r.status}
                              </span>
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                                {msg.tablePrefix} {r.tableId}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" /> {r.partySize}
                              </span>
                              {r.phone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {r.phone}
                                </span>
                              )}
                            </span>
                            {r.tags && r.tags.length > 0 && (
                              <span className="mt-1.5 flex flex-wrap gap-1">
                                {r.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
