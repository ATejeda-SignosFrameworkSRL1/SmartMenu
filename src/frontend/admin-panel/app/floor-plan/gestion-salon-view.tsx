"use client";

import { useEffect, useState } from "react";
import { FloorPlanModule } from "@smartmenu/ui";
import { useFloorPlanLive } from "@/lib/useFloorPlanLive";

/**
 * Vista cliente-only de "Gestión de Salón": consume `FloorPlanModule` de @smartmenu/ui
 * alimentado por datos REALES en vivo (useFloorPlanLive: layout persistido + estado de
 * mesas por zona vía SignalR/polling + reservas de hoy). Se carga vía next/dynamic
 * (ssr:false) porque react-konva necesita el DOM.
 */
export default function GestionSalonView() {
  const { data, reservations, palette, hostEnabled, waiterEnabled, onLayoutChange, onPaletteChange, onToggleVisibility } = useFloorPlanLive();

  // El dashboard ocupa el alto disponible (resta header + barra publicación + KPIs + paddings).
  const [dashboardHeight, setDashboardHeight] = useState(620);
  useEffect(() => {
    const calc = () => setDashboardHeight(Math.max(560, window.innerHeight - 320));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return (
    <FloorPlanModule
      data={data}
      reservations={reservations}
      onDataChange={onLayoutChange}
      dashboardHeight={dashboardHeight}
      palette={palette}
      onPaletteChange={onPaletteChange}
      hostEnabled={hostEnabled}
      waiterEnabled={waiterEnabled}
      onToggleChannel={onToggleVisibility}
    />
  );
}
