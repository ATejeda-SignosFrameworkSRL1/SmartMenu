"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "../tabs";
import { FloorPlanViewer } from "./floor-plan-viewer";
import type { FloorPlanData } from "./types";
import type { StatusPaletteOverride } from "./status-colors";

export interface MultiZoneFloorPlanViewerProps {
  data: FloorPlanData;
  width?: number;
  height?: number;
  /** Ocupa el 100% del contenedor (responsive). */
  fill?: boolean;
  /** Escala/centra el plano para llenar el área (zoom-to-fit). */
  fitToContent?: boolean;
  /** Zona activa inicial (zoneId). Default: la primera. */
  defaultZoneId?: string;
  onZoneChange?: (zoneId: string) => void;
  /** Mesa resaltada. */
  selectedTableId?: string | number;
  /** Click sobre una mesa (para seleccionarla). */
  onTableClick?: (id: string | number) => void;
  /** Override de la paleta de estados. */
  palette?: StatusPaletteOverride;
}

/**
 * Visor multi-zona (host/waiter): pestañas para cambiar de zona; el lienzo
 * muestra solo las mesas y estructuras de la zona activa, read-only. Las mesas
 * son clicables (selección).
 */
export function MultiZoneFloorPlanViewer({
  data,
  width = 800,
  height = 500,
  fill = false,
  fitToContent = false,
  defaultZoneId,
  onZoneChange,
  selectedTableId,
  onTableClick,
  palette,
}: MultiZoneFloorPlanViewerProps) {
  const [activeZoneId, setActiveZoneId] = useState(defaultZoneId ?? data.zones[0]?.zoneId ?? "");
  const activeZone = data.zones.find((z) => z.zoneId === activeZoneId) ?? data.zones[0];

  const handleZone = (id: string) => {
    setActiveZoneId(id);
    onZoneChange?.(id);
  };

  return (
    <div className={`flex flex-col gap-3 ${fill ? "h-full" : ""}`}>
      <Tabs value={activeZone?.zoneId} onValueChange={handleZone}>
        <TabsList>
          {data.zones.map((z) => (
            <TabsTrigger key={z.zoneId} value={z.zoneId}>
              {z.zoneName}
              <span className="ml-1.5 text-xs opacity-60">({z.tables.length})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeZone && (
        <div className={fill ? "min-h-0 flex-1" : undefined}>
          <FloorPlanViewer
            tables={activeZone.tables}
            structures={activeZone.structures}
            width={width}
            height={height}
            fill={fill}
            fitToContent={fitToContent}
            zoneName={activeZone.zoneName}
            selectedTableId={selectedTableId}
            onTableClick={onTableClick}
            palette={palette}
          />
        </div>
      )}
    </div>
  );
}
