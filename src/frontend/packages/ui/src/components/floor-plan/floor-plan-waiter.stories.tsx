import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useState } from "react";
import {
  Bell,
  Clock,
  LayoutGrid,
  LogOut,
  Plus,
  Receipt,
  UserPlus,
  Users,
  Utensils,
  X,
} from "lucide-react";

import { MultiZoneFloorPlanViewer } from "./multi-zone-floor-plan-viewer";
import { MULTI_ZONE_FLOOR_PLAN } from "./multi-zone-mock";
import { STATUS_COLORS, STATUS_LABELS } from "./status-colors";
import type { TableData, TableStatus } from "./types";

const GREEN = "#16a34a";
const ORANGE = "#d97706";
const VIOLET = "#7c3aed";

/** Mesa con su zona, tal como la consume el visor. */
type TableWithZone = TableData & { zoneName: string };

/** Tab único "Plano" (la vista de lista se eliminó: el plano es la única vista). */
function PlanoTab() {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm"
        style={{ backgroundColor: GREEN }}
      >
        <LayoutGrid className="h-4 w-4" /> Plano
      </button>
    </div>
  );
}

const LEGEND: TableStatus[] = ["available", "occupied", "reserved", "billing", "cleaning", "empty"];
function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50/70 px-4 py-2">
      {LEGEND.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: STATUS_COLORS[s].fill,
              border: STATUS_COLORS[s].dash ? `1px dashed ${STATUS_COLORS[s].stroke}` : `1px solid ${STATUS_COLORS[s].stroke}`,
            }}
          />
          {STATUS_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Datos mock de pedido (solo presentacional, para revisar el UX del flujo
   "click en mesa → ver el pedido"). En la waiter-app real esto se reemplaza por
   la orden viva de la mesa (filtrando /api/order/active por tableId), reutilizando
   el modal que YA usa la tarjeta de mesa del mesero — cero lógica nueva de negocio.
   ────────────────────────────────────────────────────────────────────────── */
const MOCK_DISHES = [
  { name: "Bruschetta Italiana", price: 245 },
  { name: "Churrasco a la parrilla", price: 690 },
  { name: "Mofongo de camarones", price: 520 },
  { name: "Sancocho dominicano", price: 380 },
  { name: "Pica pollo", price: 290 },
  { name: "Limonada de cereza", price: 120 },
  { name: "Cerveza Presidente", price: 180 },
  { name: "Flan de coco", price: 160 },
];
const WAITER_NAMES: Record<string, string> = { KI: "Kiara", FR: "Franklin", RO: "Rosa", MR: "María R.", JP: "Juan P.", LC: "Luis C." };

interface MockOrder {
  items: { name: string; qty: number; price: number; note?: string }[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  guests: number;
  waiter: string;
  openedMinAgo: number;
  orderStatus: string;
}

/** Construye una comanda creíble y estable a partir de la mesa (determinista por id). */
function buildMockOrder(t: TableWithZone): MockOrder {
  const seed = Number(t.id) || 1;
  const count = 2 + (seed % 3); // 2-4 ítems
  const items = Array.from({ length: count }, (_, i) => {
    const d = MOCK_DISHES[(seed * 3 + i * 2) % MOCK_DISHES.length];
    const qty = 1 + ((seed + i) % 2);
    return { name: d.name, price: d.price, qty, note: i === 0 && seed % 2 === 0 ? "Sin cebolla" : undefined };
  });
  const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
  const tax = Math.round(subtotal * 0.18 * 100) / 100; // ITBIS 18%
  const tip = Math.round(subtotal * 0.1 * 100) / 100; // propina legal 10%
  return {
    items,
    subtotal,
    tax,
    tip,
    total: subtotal + tax + tip,
    guests: Math.min(t.capacity ?? 2, 1 + (seed % 4)),
    waiter: t.waiterName ?? WAITER_NAMES[t.waiter ?? ""] ?? t.waiter ?? "—",
    openedMinAgo: 8 + (seed % 40),
    orderStatus: t.status === "billing" ? "Por cobrar" : seed % 2 === 0 ? "En preparación" : "Pendiente de confirmar",
  };
}

const RD = (n: number) => "RD$ " + n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Cabecera del modal: número de mesa + zona + badge de estado + cerrar. */
function ModalHeader({ t, onClose }: { t: TableWithZone; onClose: () => void }) {
  const c = STATUS_COLORS[t.status];
  return (
    <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: c.fill }}>
          {String(t.number ?? t.id)}
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Mesa {String(t.number ?? t.id)}</h3>
          <p className="text-xs text-slate-500">{t.zoneName} · {t.capacity ?? 2} pers.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: c.fill + "22", color: c.stroke }}>
          {STATUS_LABELS[t.status]}
        </span>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** Modal de detalle de pedido (mesa ocupada / por cobrar). */
function OrderDetailModal({ t, onClose }: { t: TableWithZone; onClose: () => void }) {
  const o = useMemo(() => buildMockOrder(t), [t]);
  const billing = t.status === "billing";
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
      <ModalHeader t={t} onClose={onClose} />

      {/* Meta — grid + centrado por estilo inline (robusto ante el CSS de Storybook). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }} className="bg-slate-100 text-xs">
        {[
          { icon: <Users className="mb-1 h-4 w-4 text-slate-400" />, v: String(o.guests), l: "Comensales" },
          { icon: <Utensils className="mb-1 h-4 w-4 text-slate-400" />, v: o.waiter, l: "Mesero" },
          { icon: <Clock className="mb-1 h-4 w-4 text-slate-400" />, v: `${o.openedMinAgo} min`, l: "Abierta" },
        ].map((c, i) => (
          <div key={i} className="bg-white px-2 py-3" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {c.icon}
            <span className="font-semibold text-slate-800">{c.v}</span>
            <span className="text-[10px] text-slate-400">{c.l}</span>
          </div>
        ))}
      </div>

      {/* Estado de la comanda */}
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Comanda</span>
        <span className="text-xs font-semibold" style={{ color: billing ? VIOLET : ORANGE }}>{o.orderStatus}</span>
      </div>

      {/* Ítems */}
      <div className="max-h-56 overflow-auto px-5 py-2">
        {o.items.map((it, i) => (
          <div key={i} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
            <div className="flex min-w-0 gap-2">
              <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1 text-[11px] font-bold text-slate-600">{it.qty}</span>
              <div>
                <p className="text-sm text-slate-800">{it.name}</p>
                {it.note && <p className="text-[11px] text-amber-600">⚠ {it.note}</p>}
              </div>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-slate-600">{RD(it.price * it.qty)}</span>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="space-y-1 bg-slate-50 px-5 py-3 text-sm">
        <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">{RD(o.subtotal)}</span></div>
        <div className="flex justify-between text-slate-500"><span>ITBIS (18%)</span><span className="tabular-nums">{RD(o.tax)}</span></div>
        <div className="flex justify-between text-slate-500"><span>Propina legal (10%)</span><span className="tabular-nums">{RD(o.tip)}</span></div>
        <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-900"><span>Total</span><span className="tabular-nums">{RD(o.total)}</span></div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 px-5 py-4">
        {billing ? (
          <>
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Receipt className="mr-1.5 inline h-4 w-4" /> Ver cuenta
            </button>
            <button type="button" className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: VIOLET }}>
              Cobrar {RD(o.total)}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Plus className="mr-1.5 inline h-4 w-4" /> Agregar ítems
            </button>
            <button type="button" className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: GREEN }}>
              <Receipt className="mr-1.5 inline h-4 w-4" /> Solicitar cuenta
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Modal compacto para mesa libre o reservada (sin orden activa). */
function NoOrderModal({ t, onClose }: { t: TableWithZone; onClose: () => void }) {
  const reserved = t.status === "reserved";
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
      <ModalHeader t={t} onClose={onClose} />
      <div className="px-5 py-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          {reserved ? <Clock className="h-6 w-6 text-amber-500" /> : <Utensils className="h-6 w-6 text-slate-400" />}
        </div>
        {reserved ? (
          <>
            <p className="text-sm font-semibold text-slate-800">Mesa reservada</p>
            <p className="mt-1 text-xs text-slate-500">Reserva: <span className="font-medium text-slate-700">José Mártir</span> · 6:30 PM · {t.capacity ?? 2} pers.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-800">Mesa libre</p>
            <p className="mt-1 text-xs text-slate-500">Sin orden activa. Identifica al comensal para tomar el pedido.</p>
          </>
        )}
      </div>
      <div className="flex gap-2 px-5 pb-5">
        {reserved ? (
          <button type="button" className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: GREEN }}>
            <UserPlus className="mr-1.5 inline h-4 w-4" /> Sentar comensal
          </button>
        ) : (
          <>
            <button type="button" className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <UserPlus className="mr-1.5 inline h-4 w-4" /> Identificar
            </button>
            <button type="button" className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: GREEN }}>
              <Plus className="mr-1.5 inline h-4 w-4" /> Tomar pedido
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Overlay + dispatcher: decide qué modal mostrar según el estado de la mesa. */
function TableModal({ table, onClose }: { table: TableWithZone | null; onClose: () => void }) {
  if (!table) return null;
  const hasOrder = table.status === "occupied" || table.status === "billing";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.55)" }}
      onClick={onClose}
    >
      <div style={{ width: "100%", maxWidth: hasOrder ? 448 : 384 }} onClick={(e) => e.stopPropagation()}>
        {hasOrder ? <OrderDetailModal t={table} onClose={onClose} /> : <NoOrderModal t={table} onClose={onClose} />}
      </div>
    </div>
  );
}

/** Réplica presentacional del shell del waiter-app + slot para toggle y contenido. */
function WaiterShell({ toggle, children }: { toggle: React.ReactNode; children: React.ReactNode }) {
  const tab = (active: boolean) =>
    `rounded-md px-6 py-2 text-sm font-medium transition ${active ? "text-white" : "text-gray-600 hover:bg-gray-100"}`;
  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      {/* Header claro */}
      <div className="bg-white shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Waiter App</h1>
              <p className="text-sm text-gray-600">Bienvenido, María</p>
            </div>
            <div className="rounded-lg bg-green-50 px-4 py-2">
              <p className="text-xs font-medium text-green-600">Ventas</p>
              <p className="text-lg font-bold text-green-700">RD$ 0.00</p>
            </div>
            <div className="rounded-lg bg-blue-50 px-4 py-2">
              <p className="text-xs font-medium text-blue-600">Propinas</p>
              <p className="text-lg font-bold text-blue-700">RD$ 0.00</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <Bell className="h-6 w-6" />
            </button>
            <span className="hidden items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> En turno
            </span>
            <div className="flex min-w-[150px] flex-col items-center justify-center rounded-lg border border-zinc-800 bg-black px-4 py-1.5 font-mono shadow-inner">
              <span className="text-xl leading-none tracking-widest text-white">11:18:56</span>
              <span className="text-[9px] font-bold leading-none text-amber-300">AM</span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-400">mié, 17 jun</span>
            </div>
            <button type="button" className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white">
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4">
        <div className="inline-flex rounded-lg bg-white p-1 shadow">
          <button type="button" className={tab(true)} style={{ backgroundColor: GREEN }}>Mesas General (27)</button>
          <button type="button" className={tab(false)}>Mis Mesas (0)</button>
        </div>
        {toggle}
        <button type="button" className="ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: ORANGE }}>
          <Users className="h-5 w-5" /> Crear mesa virtual
        </button>
        <button type="button" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
          Reservas · Jue 18 Jun
        </button>
      </div>

      {/* Contenido */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <h2 className="mb-1 text-xl font-bold text-gray-900">Todas las Mesas (27)</h2>
        {children}
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Floor Plan/Waiter Panel",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

/** Resuelve la mesa (con su zona) a partir del id que emite el visor. */
function findTable(id: string | number | null): TableWithZone | null {
  if (id == null) return null;
  for (const z of MULTI_ZONE_FLOOR_PLAN.zones) {
    const t = z.tables.find((x) => x.id === id);
    if (t) return { ...t, zoneName: z.zoneName };
  }
  return null;
}

/**
 * Waiter-app con el plano de salón integrado en SOLO-LECTURA + interacción de negocio.
 * Vista única "Plano". Click en una mesa:
 *  - Ocupada / Por cobrar → abre el detalle del pedido (ítems, ITBIS 18%, propina 10%, total).
 *  - Libre → CTA "Identificar / Tomar pedido".  · Reservada → datos de la reserva.
 * El plano es otra VISTA de las mismas mesas: el click reutiliza el mismo flujo que la
 * tarjeta de mesa. (Mock presentacional para revisar UX; la app real consume la orden viva.)
 */
export const ConPlano: Story = {
  render: () => {
    const Demo = () => {
      const [sel, setSel] = useState<string | number | null>(null);
      const selected = findTable(sel);
      return (
        <WaiterShell toggle={<PlanoTab />}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
              <span>Toca una mesa para ver su pedido</span>
              <span className="hidden sm:inline">Plano en solo lectura · estado en vivo</span>
            </div>
            <div style={{ height: 520 }}>
              <MultiZoneFloorPlanViewer
                data={MULTI_ZONE_FLOOR_PLAN}
                fill
                fitToContent
                selectedTableId={sel ?? undefined}
                onTableClick={(id) => setSel(id)}
              />
            </div>
            <StatusLegend />
          </div>
          <TableModal table={selected} onClose={() => setSel(null)} />
        </WaiterShell>
      );
    };
    return <Demo />;
  },
};
