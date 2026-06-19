import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { FloorPlanDashboard, type Reservation } from "./floor-plan-dashboard";
import { MULTI_ZONE_FLOOR_PLAN } from "./multi-zone-mock";
import type { FloorPlanData } from "./types";

/**
 * Reservaciones mock POR ZONA — `zoneId` coincide con las zonas del mock multi-zona
 * y `tableId` con mesas reales de cada zona. La barra derecha muestra solo las de la
 * zona activa (cambia al cambiar de pestaña en el lienzo).
 */
const RESERVATIONS: Reservation[] = [
  // ── Terraza (zoneId 1, mesas 1-8) ──
  { id: "r5", zoneId: "1", time: "11:30 AM", customerName: "Heidi-Marie", partySize: 6, status: "Confirmado", tableId: 3 },
  { id: "r6", zoneId: "1", time: "12:30 PM", customerName: "Ana Belén", partySize: 2, status: "Sentado", tableId: 6 },
  { id: "r7", zoneId: "1", time: "1:00 PM", customerName: "Grupo Sánchez", partySize: 4, status: "Confirmado", tableId: 8 },
  // ── Salón Principal (zoneId 2, mesas 9-16) ──
  { id: "r1", zoneId: "2", time: "11:30 AM", customerName: "Donald Duck", partySize: 4, status: "Confirmado", tableId: 12 },
  { id: "r2", zoneId: "2", time: "11:30 AM", customerName: "Larry Letmore", partySize: 2, status: "Sentado", tableId: 10 },
  { id: "r3", zoneId: "2", time: "12:00 PM", customerName: "George Lancie", partySize: 4, status: "Confirmado", tableId: 15 },
  { id: "r4", zoneId: "2", time: "1:00 PM", customerName: "Carlos Mota", partySize: 2, status: "Esperando", tableId: 9 },
  // ── VIP (zoneId 3, mesas 17-24) ──
  { id: "r8", zoneId: "3", time: "12:00 PM", customerName: "Mauricio Peña", partySize: 5, status: "Confirmado", tableId: 17 },
  { id: "r9", zoneId: "3", time: "1:00 PM", customerName: "Sr. Holt (VIP)", partySize: 4, status: "Sentado", tableId: 19 },
  { id: "r10", zoneId: "3", time: "1:30 PM", customerName: "Embajada Nórdica", partySize: 4, status: "Esperando", tableId: 21 },
  // ── Terraza Norte (zoneId 4, mesas 25-27) ──
  { id: "r11", zoneId: "4", time: "12:30 PM", customerName: "Familia Ramírez", partySize: 8, status: "Esperando", tableId: 27 },
  { id: "r12", zoneId: "4", time: "12:30 PM", customerName: "Lucía Fermín", partySize: 2, status: "Confirmado", tableId: 25 },
  { id: "r13", zoneId: "4", time: "1:00 PM", customerName: "Pedro Castillo", partySize: 4, status: "Sentado", tableId: 26 },
];

const meta: Meta<typeof FloorPlanDashboard> = {
  title: "Floor Plan/Dashboard",
  component: FloorPlanDashboard,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof FloorPlanDashboard>;

/**
 * Panel de administración completo (estilo Reseasy):
 * - Toggle "En Vivo / Diseñador" arriba a la izquierda.
 * - La barra derecha muestra los comensales de la ZONA ACTIVA; cambiá de pestaña
 *   (Salón Principal / Terraza / VIP / Terraza Norte) y la lista se actualiza.
 * - En "Diseñador" arrastrá una mesa → el cambio se refleja (estado en `useState`).
 * - En "En Vivo" clic en una mesa → resalta su reservación (y viceversa).
 */
export const CompletoReseasyStyle: Story = {
  render: () => {
    const Demo = () => {
      const [data, setData] = useState<FloorPlanData>(MULTI_ZONE_FLOOR_PLAN);
      return (
        <div className="p-4">
          <FloorPlanDashboard data={data} reservations={RESERVATIONS} onDataChange={setData} />
        </div>
      );
    };
    return <Demo />;
  },
};
