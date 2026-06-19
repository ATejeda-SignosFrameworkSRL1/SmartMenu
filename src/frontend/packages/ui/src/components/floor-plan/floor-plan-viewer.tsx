"use client";

import { FloorPlanCanvas } from "./floor-plan-canvas";
import type { TableData, StructureData } from "./types";
import type { StatusPaletteOverride } from "./status-colors";

export interface FloorPlanViewerProps {
  tables: TableData[];
  structures?: StructureData[];
  width?: number;
  height?: number;
  zoneName?: string;
  /** Ocupa el 100% del contenedor (responsive). */
  fill?: boolean;
  /** Escala/centra el plano para llenar el área (zoom-to-fit). */
  fitToContent?: boolean;
  /** Mesa resaltada. */
  selectedTableId?: string | number;
  /** Click sobre una mesa (para seleccionarla). */
  onTableClick?: (id: string | number) => void;
  /** Override de la paleta de estados. */
  palette?: StatusPaletteOverride;
}

/**
 * Visor de plano de SOLO LECTURA (host/waiter) de UNA zona. Mesas + estructuras
 * fijas; nada arrastrable, pero las mesas son clicables (selección). Para varias
 * zonas, usar MultiZoneFloorPlanViewer.
 */
export function FloorPlanViewer({
  tables,
  structures,
  width,
  height,
  zoneName,
  fill = false,
  fitToContent = false,
  selectedTableId,
  onTableClick,
  palette,
}: FloorPlanViewerProps) {
  return (
    <FloorPlanCanvas
      tables={tables}
      structures={structures}
      width={width}
      height={height}
      zoneName={zoneName}
      fill={fill}
      fitToContent={fitToContent}
      draggable={false}
      structureDraggable={false}
      selectedTableId={selectedTableId}
      onTableClick={onTableClick}
      palette={palette}
    />
  );
}
