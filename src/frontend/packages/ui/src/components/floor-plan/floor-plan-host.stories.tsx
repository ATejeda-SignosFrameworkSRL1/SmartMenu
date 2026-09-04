import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ArrowLeft, ArrowRightLeft, Calendar, CalendarCheck, CalendarPlus, Clock, LayoutGrid, LogOut, Phone, Receipt, UserPlus, Users, X } from "lucide-react";

import { MultiZoneFloorPlanViewer } from "./multi-zone-floor-plan-viewer";
import { MULTI_ZONE_FLOOR_PLAN } from "./multi-zone-mock";
import { STATUS_COLORS, STATUS_LABELS } from "./status-colors";
import type { TableStatus } from "./types";

const GREEN = "#16a34a";
type View = "list" | "plan";

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

const SLOTS = ["12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM"];

function MesaCard({ n, zone, capacity }: { n: string; zone: string; capacity: number }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="h-1.5 w-full bg-emerald-500" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between">
          <span className="text-4xl font-black leading-none text-slate-900">{n}</span>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
            Disponible
          </span>
        </div>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{zone}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <Users className="h-3 w-3" /> {capacity} personas
        </p>
        <button type="button" className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-bold text-indigo-700">
          <CalendarCheck className="h-4 w-4" /> Ver reservas
        </button>
        <div className="mt-2">
          <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
            <Clock className="h-3 w-3" /> Horarios libres (15)
          </p>
          <div className="flex flex-wrap gap-1">
            {SLOTS.map((s) => (
              <span key={s} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold leading-none text-emerald-700">
                {s}
              </span>
            ))}
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold leading-none text-slate-600">+10 más</span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <button type="button" className="w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#10b981" }}>
            Asignar
          </button>
          <button type="button" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700">
            Reservar
          </button>
        </div>
      </div>
    </div>
  );
}

function FiltersCard({ rightSlot }: { rightSlot: React.ReactNode }) {
  const zoneChip = (label: string, count: string, active = false) => (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${active ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      style={active ? { backgroundColor: GREEN } : undefined}
    >
      {label}
      {count && <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/25 text-white" : "bg-gray-200 text-gray-500"}`}>{count}</span>}
    </button>
  );
  const pill = (label: string, active = false, dot?: string) => (
    <button type="button" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"}`}>
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
    </button>
  );
  const resPill = (label: string, active = false) => (
    <button type="button" className={`rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-gray-200 bg-white text-gray-600"}`}>
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Zona</p>
        {rightSlot}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {zoneChip("Todas", "", true)}
        {zoneChip("Terraza", "8/8")}
        {zoneChip("Salón Principal", "8/8")}
        {zoneChip("VIP", "8/8")}
        {zoneChip("Terraza Norte", "3/3")}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Reservas</p>
        <div className="flex flex-wrap gap-2">
          {resPill("Cualquier momento", true)}
          {resPill("Hoy")}
          {resPill("Mañana")}
          {resPill("Esta semana")}
          {resPill("Personalizado")}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Estado</p>
            <div className="flex flex-wrap gap-2">
              {pill("Todos", true)}
              {pill("Disponible", false, "bg-green-500")}
              {pill("Ocupada", false, "bg-red-500")}
              {pill("Por cobrar", false, "bg-violet-500")}
              {pill("Reservada", false, "bg-amber-400")}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Capacidad</p>
            <div className="flex flex-wrap gap-2">
              {pill("Todas", true)}
              {pill("1–2 personas")}
              {pill("3–4 personas")}
              {pill("5+ personas")}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none text-gray-900">27</p>
          <p className="text-xs text-gray-400">mesas</p>
        </div>
      </div>
    </div>
  );
}

function HostShell({ children }: { children: React.ReactNode }) {
  const tab = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${active ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`;
  const kpi = (n: string, label: string, color: string) => (
    <div className="min-w-[84px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center">
      <p className="text-2xl font-black leading-none text-white">{n}</p>
      <p className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}>{label}</p>
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <div className="bg-slate-900 shadow-xl">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Host App</h1>
              <p className="text-sm text-slate-400">Bienvenido, Laura Martínez</p>
            </div>
            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <button type="button" className={tab(true)}>Mesas</button>
              <button type="button" className={tab(false)}><CalendarCheck className="h-4 w-4" /> Reservas</button>
              <button type="button" className={tab(false)}><Calendar className="h-4 w-4" /> Calendario</button>
            </div>
            <button type="button" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white">
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {kpi("27", "Libres", "text-emerald-400")}
            {kpi("0", "Ocupadas", "text-red-400")}
            {kpi("0", "Por cobrar", "text-violet-400")}
            {kpi("0", "Reservadas", "text-amber-400")}
            {kpi("104", "Asientos libres", "text-slate-400")}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-5">{children}</div>
    </div>
  );
}

const ALL_TABLES = MULTI_ZONE_FLOOR_PLAN.zones.flatMap((z) =>
  z.tables.map((t) => ({ n: String(t.number ?? t.id), zone: z.zoneName, capacity: t.capacity ?? 4 })),
);

type HostTable = { id: string | number; number: string; status: TableStatus; zoneName: string; capacity: number };

function findHostTable(id: string | number | null): HostTable | null {
  if (id == null) return null;
  for (const z of MULTI_ZONE_FLOOR_PLAN.zones) {
    const t = z.tables.find((x) => x.id === id);
    if (t) return { id: t.id, number: String(t.number ?? t.id), status: t.status, zoneName: z.zoneName, capacity: t.capacity ?? 4 };
  }
  return null;
}

const RES_NAMES = ["José Mártir", "Ana Gómez", "Carlos Reyes", "Lucía Peña", "Miguel Santos"];
const HOST_WAITERS = ["Kiara", "Franklin", "Rosa", "María", "Pedro"];
const RD = (n: number) => "RD$ " + n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function HostTableModal({ table, onClose }: { table: HostTable | null; onClose: () => void }) {
  if (!table) return null;
  const seed = Number(table.id) || 1;
  const c = STATUS_COLORS[table.status] ?? STATUS_COLORS.available;
  const primary = "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white";
  const outline = "flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

  let body: React.ReactNode;
  if (table.status === "occupied") {
    const meta = [
      { label: "Comensales", value: String(Math.min(table.capacity, 1 + (seed % 4))) },
      { label: "Mesero", value: HOST_WAITERS[seed % HOST_WAITERS.length] },
      { label: "Abierta", value: `${8 + (seed % 40)} min` },
    ];
    body = (
      <div className="p-5">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }} className="overflow-hidden rounded-lg bg-slate-100 text-center text-xs">
          {meta.map((m) => (
            <div key={m.label} className="bg-white px-2 py-3">
              <p className="font-semibold text-slate-800">{m.value}</p>
              <p className="text-[10px] text-slate-400">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <button type="button" className={outline}><ArrowRightLeft className="h-4 w-4" /> Transferir mesa</button>
          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  } else if (table.status === "billing") {
    const total = 800 + ((seed * 215) % 3000);
    body = (
      <div className="p-5">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
          <span className="text-sm text-slate-600">Total por cobrar</span>
          <span className="text-lg font-bold text-slate-900">{RD(total)}</span>
        </div>
        <button type="button" className={`${primary} mt-3`} style={{ backgroundColor: "#7c3aed" }}><Receipt className="h-4 w-4" /> Ver cuenta</button>
      </div>
    );
  } else if (table.status === "reserved") {
    const r = {
      name: RES_NAMES[seed % RES_NAMES.length],
      time: ["6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM"][seed % 4],
      guests: Math.min(table.capacity, 2 + (seed % 3)),
      phone: "809 555 " + String(1000 + ((seed * 137) % 9000)),
    };
    body = (
      <div className="p-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-900">{r.name}</span>
            <span className="text-xs font-semibold text-amber-700">{r.time}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-800">
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {r.guests} pers.</span>
            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {r.phone}</span>
          </p>
        </div>
        <div className="mt-3 space-y-2">
          <button type="button" className={primary} style={{ backgroundColor: GREEN }}><UserPlus className="h-4 w-4" /> Sentar reserva</button>
          <button type="button" className={outline}><CalendarCheck className="h-4 w-4" /> Ver reservas</button>
        </div>
      </div>
    );
  } else {

    body = (
      <div className="space-y-2 p-5">
        <p className="mb-1 text-xs text-slate-500">Mesa libre — elige una acción:</p>
        <button type="button" className={primary} style={{ backgroundColor: GREEN }}><UserPlus className="h-4 w-4" /> Sentar comensales</button>
        <button type="button" className={outline}><CalendarPlus className="h-4 w-4" /> Reservar</button>
        <button type="button" className={outline}><CalendarCheck className="h-4 w-4" /> Ver reservas</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15, 23, 42, 0.55)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420 }} onClick={(e) => e.stopPropagation()} className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: c.fill }}>{table.number}</div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Mesa {table.number}</h3>
              <p className="text-xs text-slate-500">{table.zoneName} · {table.capacity} pers.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: c.fill + "22", color: c.stroke }}>{STATUS_LABELS[table.status]}</span>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
          </div>
        </div>
        {body}
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Floor Plan/Host Panel",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

export const ListaConBotonPlano: Story = {
  render: () => {
    const Demo = () => {
      const [view, setView] = useState<View>("list");
      const [sel, setSel] = useState<string | number | null>(null);

      if (view === "plan") {
        return (
          <HostShell>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Plano del salón</h2>
              <button
                type="button"
                onClick={() => setView("list")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a la lista
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
                <span>Toca una mesa para gestionarla</span>
                <span className="hidden sm:inline">Plano en vivo · estado por color</span>
              </div>
              <div style={{ height: 560 }}>
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
            <HostTableModal table={findHostTable(sel)} onClose={() => setSel(null)} />
          </HostShell>
        );
      }

      return (
        <HostShell>
          <FiltersCard
            rightSlot={
              <button
                type="button"
                onClick={() => setView("plan")}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                style={{ backgroundColor: GREEN }}
              >
                <LayoutGrid className="h-4 w-4" /> Ver plano
              </button>
            }
          />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {ALL_TABLES.map((t) => (
              <MesaCard key={t.n} n={t.n} zone={t.zone} capacity={t.capacity} />
            ))}
          </div>
        </HostShell>
      );
    };
    return <Demo />;
  },
};
