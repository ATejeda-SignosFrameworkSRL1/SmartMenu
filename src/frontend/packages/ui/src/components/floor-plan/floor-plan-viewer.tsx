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

  fill?: boolean;

  fitToContent?: boolean;

  selectedTableId?: string | number;

  onTableClick?: (id: string | number) => void;

  palette?: StatusPaletteOverride;
}

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
