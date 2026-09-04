"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FloorPlanModule } from "@smartmenu/ui";
import { useFloorPlanLive } from "@/lib/useFloorPlanLive";

export default function GestionSalonView() {
  const t = useTranslations("floorPlan");
  const { data, reservations, palette, hostEnabled, waiterEnabled, onLayoutChange, onPaletteChange, onToggleVisibility } = useFloorPlanLive();

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
      messages={{
        kpiTables: t("kpiTables"),
        kpiOccupancy: t("kpiOccupancy"),
        kpiReservations: t("kpiReservations"),
        kpiNextReservation: t("kpiNextReservation"),
        tablesSub: (zones, reserved) => t("tablesSub", { zones, reserved }),
        occupancySub: (occupied, total) => t("occupancySub", { occupied, total }),
        reservationsSub: (guests) => t("reservationsSub", { guests }),
        nextSub: (customerName, tableId) => t("nextSub", { customerName, tableId }),
        noReservations: t("noReservations"),
        stateVisible: t("stateVisible"),
        statePartial: t("statePartial"),
        stateHidden: t("stateHidden"),
        publishTitle: t("publishTitle"),
        publishHint: t("publishHint"),
        channelHost: t("channelHost"),
        channelWaiter: t("channelWaiter"),
        switchAria: (show, label) => t(show ? "switchHide" : "switchShow", { label }),
        switchTitleOn: (label) => t("switchTitleOn", { label }),
        switchTitleOff: (label) => t("switchTitleOff", { label }),
      }}
      dashboardMessages={{
        canvasTitle: t("canvasTitle"),
        modeLive: t("modeLive"),
        modeDesigner: t("modeDesigner"),
        paletteButton: t("paletteButton"),
        paletteReset: t("paletteReset"),
        reservationsTitle: t("reservationsTitle"),
        reservationsSummary: (zoneName, count, guests) => t("resSummary", { zoneName, count, guests }),
        searchPlaceholder: t("searchPlaceholder"),
        newButton: t("newButton"),
        emptyZoneTitle: t("emptyZoneTitle"),
        emptyZoneSub: t("emptyZoneSub"),
        emptySearchTitle: t("emptySearchTitle"),
        emptySearchSub: t("emptySearchSub"),
        tablePrefix: t("tablePrefix"),
      }}
      statusLabels={{
        empty: t("statusEmpty"),
        available: t("statusAvailable"),
        occupied: t("statusOccupied"),
        reserved: t("statusReserved"),
        cleaning: t("statusCleaning"),
        billing: t("statusBilling"),
      }}
    />
  );
}
