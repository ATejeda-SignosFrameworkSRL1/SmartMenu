"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Inbox, Palette, Pencil, Phone, Search, Users } from "lucide-react";

import { MultiZoneFloorPlanViewer } from "./multi-zone-floor-plan-viewer";
import { MultiZoneFloorPlanEditor } from "./multi-zone-floor-plan-editor";
import { STATUS_LABELS, resolveStatusColors, type StatusPaletteOverride } from "./status-colors";
import type { FloorPlanData, TableStatus } from "./types";

/** Paleta para avatares de comensales (hash por nombre). */
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

/** Estados mostrados en la leyenda del lienzo, en orden. */
const LEGEND_STATUSES: TableStatus[] = ["available", "occupied", "reserved", "billing", "cleaning", "empty"];

export type ReservationStatus = "Confirmado" | "Sentado" | "Esperando";

export interface Reservation {
  id: string;
  /** Zona a la que pertenece (debe coincidir con FloorPlanZone.zoneId). */
  zoneId: string;
  /** Bloque de hora, ej. "11:30 AM". */
  time: string;
  customerName: string;
  partySize: number;
  status: ReservationStatus;
  /** Mesa asignada — debe coincidir con un TableData.id (ej. "S-4"). */
  tableId: string | number;
  /** Teléfono de contacto (opcional). */
  phone?: string;
  /** Etiquetas: VIP, Cumpleaños, Ventana, Alergia… (opcional). */
  tags?: string[];
}

export interface FloorPlanDashboardProps {
  data: FloorPlanData;
  reservations: Reservation[];
  /** Cambios de layout en Modo Diseñador (drag de mesas/estructuras). */
  onDataChange?: (data: FloorPlanData) => void;
  /** Alto del dashboard en px. Default 750. */
  height?: number;
  /** Paleta de estados (override). */
  palette?: StatusPaletteOverride;
  /** Guardar paleta editada. */
  onPaletteChange?: (palette: StatusPaletteOverride) => void;
}

const STATUS_BADGE: Record<ReservationStatus, string> = {
  Confirmado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Sentado: "bg-blue-50 text-blue-700 ring-blue-200",
  Esperando: "bg-amber-50 text-amber-700 ring-amber-200",
};

/** Color de la barra de acento (izquierda) de cada tarjeta, por estado. */
const STATUS_ACCENT: Record<ReservationStatus, string> = {
  Confirmado: "#10B981",
  Sentado: "#3B82F6",
  Esperando: "#F59E0B",
};

/**
 * Maqueta del panel de administración del plano (estilo Reseasy): split 70/30.
 * Izquierda: toggle "En Vivo" (viewer) / "Diseñador" (editor) + lienzo multi-zona.
 * Derecha: reservaciones de la ZONA ACTIVA (cambian al cambiar de pestaña), agrupadas
 * por hora. Click en mesa ↔ resalta su reservación (estado `selectedTableId`).
 */
export function FloorPlanDashboard({ data, reservations, onDataChange, height = 750, palette, onPaletteChange }: FloorPlanDashboardProps) {
  const colors = resolveStatusColors(palette);
  const [mode, setMode] = useState<"live" | "designer">("live");
  const [activeZoneId, setActiveZoneId] = useState(data.zones[0]?.zoneId ?? "");
  const [selectedTableId, setSelectedTableId] = useState<string | number | null>(null);
  const [query, setQuery] = useState("");
  const [showPalette, setShowPalette] = useState(false);

  const handleZoneChange = (id: string) => {
    setActiveZoneId(id);
    setSelectedTableId(null); // la mesa seleccionada no pertenece a la nueva zona
  };

  const activeZoneName = data.zones.find((z) => z.zoneId === activeZoneId)?.zoneName ?? "";

  // Reservaciones de la zona activa (filtradas por búsqueda), agrupadas por hora.
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

  const modeBtn = (active: boolean) =>
    `rounded-md px-3 py-1 font-medium transition ${
      active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div
      className="flex w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900"
      style={{ height }}
    >
      {/* ── Columna izquierda (70%): lienzo ── */}
      <div className="flex w-[70%] flex-col">
        <div className="border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Plano de planta</h2>
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
                  <Palette className="h-3.5 w-3.5" /> Colores
                </button>
              )}
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
                <button type="button" onClick={() => setMode("live")} className={modeBtn(mode === "live")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    En Vivo
                  </span>
                </button>
                <button type="button" onClick={() => setMode("designer")} className={modeBtn(mode === "designer")}>
                  <span className="inline-flex items-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Diseñador
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
                  {STATUS_LABELS[s]}
                </label>
              ))}
              <button
                type="button"
                onClick={() => onPaletteChange({})}
                className="ml-auto self-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Restablecer
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 p-4">
          {mode === "live" ? (
            <MultiZoneFloorPlanViewer
              data={data}
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

        {/* Leyenda de estados */}
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
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {/* ── Columna derecha (30%): reservaciones de la zona activa ── */}
      <aside className="flex w-[30%] flex-col border-l border-slate-200 bg-slate-50">
        <div className="space-y-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Reservaciones</h3>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <Users className="h-3.5 w-3.5" /> {guests}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeZoneName} · {count} {count === 1 ? "reserva" : "reservas"} · {guests} comensales
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar reserva…"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <button
              type="button"
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Nueva
            </button>
          </div>
        </div>

        <div className="h-full space-y-5 overflow-y-auto p-4">
          {count === 0 ? (
            <div className="mt-10 flex flex-col items-center text-center text-slate-400">
              <Inbox className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm font-medium text-slate-500">
                {zoneTotal === 0 ? "Sin reservaciones en esta zona" : "Sin resultados"}
              </p>
              <p className="mt-0.5 text-xs">
                {zoneTotal === 0 ? "Las nuevas reservas aparecerán aquí" : "Probá con otro nombre o mesa"}
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
                                Mesa {r.tableId}
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
