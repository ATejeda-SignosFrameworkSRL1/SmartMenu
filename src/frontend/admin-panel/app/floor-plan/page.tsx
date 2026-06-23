"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";

// react-konva necesita el DOM → cargar la composición solo en cliente.
const GestionSalonView = dynamic(() => import("./gestion-salon-view"), {
  ssr: false,
  loading: () => <FloorPlanLoading />,
});

function FloorPlanLoading() {
  const t = useTranslations("floorPlan");
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">{t("pageLoading")}</div>
  );
}

export default function FloorPlanPage() {
  const t = useTranslations("floorPlan");
  return (
    <MainLayout title={t("pageTitle")} subtitle={t("pageSubtitle")}>
      <GestionSalonView />
    </MainLayout>
  );
}
