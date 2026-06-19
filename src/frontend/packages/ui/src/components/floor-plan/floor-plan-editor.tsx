"use client";

import { useState } from "react";

import { FloorPlanCanvas } from "./floor-plan-canvas";
import type { TableData } from "./types";

export interface FloorPlanEditorProps {
  initialTables: TableData[];
  width?: number;
  height?: number;
  zoneName?: string;
  onChange?: (tables: TableData[]) => void;
}

/**
 * Editor interactivo de UNA zona (admin). Al soltar una mesa se actualizan sus
 * coordenadas en el estado local. Para varias zonas, usar MultiZoneFloorPlanEditor.
 */
export function FloorPlanEditor({ initialTables, width, height, zoneName, onChange }: FloorPlanEditorProps) {
  const [tables, setTables] = useState<TableData[]>(initialTables);

  const handleDragEnd = (id: string | number, x: number, y: number) => {
    const next = tables.map((t) => (t.id === id ? { ...t, x, y } : t));
    setTables(next);
    onChange?.(next);
  };

  return (
    <FloorPlanCanvas
      tables={tables}
      width={width}
      height={height}
      zoneName={zoneName}
      draggable
      onTableDragEnd={handleDragEnd}
    />
  );
}
