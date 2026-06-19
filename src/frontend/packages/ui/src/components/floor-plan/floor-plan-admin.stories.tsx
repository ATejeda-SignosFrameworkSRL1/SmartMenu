import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  Armchair,
  BarChart3,
  Bell,
  CalendarCheck,
  ChefHat,
  ChevronRight,
  Clock,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Menu as MenuIcon,
  PanelLeft,
  Search,
  Settings,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  Wine,
  Wrench,
} from "lucide-react";

import { FloorPlanModule } from "./floor-plan-module";
import { type Reservation } from "./floor-plan-dashboard";
import { MULTI_ZONE_FLOOR_PLAN } from "./multi-zone-mock";
import type { FloorPlanData } from "./types";

/** Reservaciones mock por zona (mismas que el dashboard). */
const RESERVATIONS: Reservation[] = [
  // Terraza (zoneId 1, mesas 1-8)
  { id: "r5", zoneId: "1", time: "11:30 AM", customerName: "Heidi-Marie", partySize: 6, status: "Confirmado", tableId: 3, phone: "809-555-0231", tags: ["Aniversario"] },
  { id: "r6", zoneId: "1", time: "12:30 PM", customerName: "Ana Belén", partySize: 2, status: "Sentado", tableId: 6, phone: "829-555-0274" },
  { id: "r7", zoneId: "1", time: "1:00 PM", customerName: "Grupo Sánchez", partySize: 4, status: "Confirmado", tableId: 8, phone: "809-555-0319", tags: ["Grupo"] },
  // Salón Principal (zoneId 2, mesas 9-16)
  { id: "r1", zoneId: "2", time: "11:30 AM", customerName: "Donald Duck", partySize: 4, status: "Confirmado", tableId: 12, phone: "809-555-0142", tags: ["VIP"] },
  { id: "r2", zoneId: "2", time: "11:30 AM", customerName: "Larry Letmore", partySize: 2, status: "Sentado", tableId: 10, phone: "809-555-0198", tags: ["Ventana"] },
  { id: "r3", zoneId: "2", time: "12:00 PM", customerName: "George Lancie", partySize: 4, status: "Confirmado", tableId: 15, phone: "829-555-0110", tags: ["Cumpleaños"] },
  { id: "r4", zoneId: "2", time: "1:00 PM", customerName: "Carlos Mota", partySize: 2, status: "Esperando", tableId: 9, phone: "809-555-0167" },
  // VIP (zoneId 3, mesas 17-24)
  { id: "r8", zoneId: "3", time: "12:00 PM", customerName: "Mauricio Peña", partySize: 5, status: "Confirmado", tableId: 17, phone: "809-555-0401", tags: ["VIP"] },
  { id: "r9", zoneId: "3", time: "1:00 PM", customerName: "Sr. Holt (VIP)", partySize: 4, status: "Sentado", tableId: 19, phone: "829-555-0420", tags: ["VIP", "Alergia: gluten"] },
  { id: "r10", zoneId: "3", time: "1:30 PM", customerName: "Embajada Nórdica", partySize: 4, status: "Esperando", tableId: 21, phone: "809-555-0455", tags: ["Protocolo"] },
  // Terraza Norte (zoneId 4, mesas 25-27)
  { id: "r11", zoneId: "4", time: "12:30 PM", customerName: "Familia Ramírez", partySize: 8, status: "Esperando", tableId: 27, phone: "809-555-0512", tags: ["Niños"] },
  { id: "r12", zoneId: "4", time: "12:30 PM", customerName: "Lucía Fermín", partySize: 2, status: "Confirmado", tableId: 25, phone: "829-555-0566" },
  { id: "r13", zoneId: "4", time: "1:00 PM", customerName: "Pedro Castillo", partySize: 4, status: "Sentado", tableId: 26, phone: "809-555-0598", tags: ["Cumpleaños"] },
];

// ── Paleta del shell admin (de admin-panel/app/globals.css) ──
const SIDEBAR_BG = "#2b2b2b"; //  hsl(0 0% 17%)
const BRAND = "#8a0000"; //       hsl(0 100% 27%) — primary / item activo

interface NavItem {
  label: string;
  Icon: LucideIcon;
  active?: boolean;
  badge?: number;
}

const NAV: NavItem[] = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Órdenes", Icon: ShoppingBag, badge: 3 },
  { label: "Menú", Icon: MenuIcon },
  { label: "Mesas", Icon: MapPin },
  { label: "Gestión de Salón", Icon: Armchair, active: true },
  { label: "Cocina (KDS)", Icon: ChefHat, badge: 2 },
  { label: "Bar", Icon: Wine },
  { label: "Reservas", Icon: CalendarCheck, badge: 5 },
  { label: "Mantenimiento", Icon: Wrench },
  { label: "Usuarios", Icon: Users },
  { label: "Reportes", Icon: BarChart3 },
];

/** Réplica presentacional del sidebar + topbar del admin-panel. */
function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full overflow-hidden text-slate-900" style={{ height: 950 }}>
      {/* ── Sidebar ── */}
      <aside className="flex w-64 flex-shrink-0 flex-col" style={{ backgroundColor: SIDEBAR_BG, color: "#f5f5f5" }}>
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: BRAND }}>
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-tight">SmartMenu</span>
            <span className="text-xs text-white/60">Sistema de Gestión</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <p className="mb-2 px-3 text-xs uppercase tracking-wider text-white/50">Operaciones</p>
          <ul className="space-y-1">
            {NAV.map(({ label, Icon, active, badge }) => (
              <li key={label}>
                <a
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active ? "font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                  style={active ? { backgroundColor: BRAND } : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge != null && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                        active ? "bg-white/20 text-white" : "bg-white/10 text-white/80"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-medium">AS</div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">Admin System</span>
            <span className="truncate text-xs text-white/50">admin@smartmenu.com</span>
          </div>
          <Settings className="h-4 w-4 flex-shrink-0 text-white/50" />
        </div>
      </aside>

      {/* ── Columna principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
          <PanelLeft className="h-5 w-5 flex-shrink-0 text-slate-500" />
          <div className="min-w-0">
            <nav className="flex items-center gap-1 text-xs text-slate-400">
              <span>Operaciones</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-slate-600">Gestión de Salón</span>
            </nav>
            <h1 className="text-lg font-bold leading-tight text-slate-900">Gestión de Salón</h1>
          </div>

          <div className="relative ml-auto hidden w-72 max-w-[40%] md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar mesa, reserva o cliente…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            <span className="font-medium">12:26 p.m.</span>
            <span className="hidden lg:inline">mar 16 de jun</span>
          </div>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <Bell className="h-5 w-5" />
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: BRAND }}
            >
              3
            </span>
          </button>

          <span className="hidden h-7 w-px bg-slate-200 sm:block" />
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: BRAND }}
          >
            AS
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6" style={{ backgroundColor: "#f5f5f5" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

const meta: Meta<typeof FloorPlanModule> = {
  title: "Floor Plan/Gestión de Salón",
  component: FloorPlanModule,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof FloorPlanModule>;

/**
 * El módulo "Gestión de Salón" (plano de planta) maquetado DENTRO del shell del admin-panel:
 * - Sidebar charcoal con la navegación real (Operaciones), "Gestión de Salón" activo (ítem propio, no "Mesas").
 * - Topbar con título, reloj y campana.
 * - Barra de publicación: exportar la distribución a Host / Mesero / a todos
 *   (los botones reflejan el estado de sincronización).
 * - Dashboard multi-zona: toggle En Vivo/Diseñador + reservaciones por zona.
 */
export const DentroDelAdmin: Story = {
  render: () => {
    const Demo = () => {
      const [data, setData] = useState<FloorPlanData>(MULTI_ZONE_FLOOR_PLAN);
      const [vis, setVis] = useState({ host: true, waiter: true });
      return (
        <AdminShell>
          <FloorPlanModule
            data={data}
            reservations={RESERVATIONS}
            onDataChange={setData}
            hostEnabled={vis.host}
            waiterEnabled={vis.waiter}
            onToggleChannel={(target, enabled) => setVis((v) => ({ ...v, [target]: enabled }))}
          />
        </AdminShell>
      );
    };
    return <Demo />;
  },
};
