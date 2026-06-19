"use client";

import dynamic from "next/dynamic";
import { MainLayout } from "@/components/layout/MainLayout";

// react-konva necesita el DOM → cargar la composición solo en cliente.
const GestionSalonView = dynamic(() => import("./gestion-salon-view"), {
  ssr: false,
  loading: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">Cargando plano de salón…</div>
  ),
});

export default function FloorPlanPage() {
  return (
    <MainLayout title="Gestión de Salón" subtitle="Plano de planta y reservas del salón">
      <GestionSalonView />
    </MainLayout>
  );
}
