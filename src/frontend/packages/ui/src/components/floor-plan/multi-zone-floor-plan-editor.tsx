"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "../tabs";
import { FloorPlanCanvas } from "./floor-plan-canvas";
import { TablePropertiesPanel } from "./table-properties-panel";
import type { FloorPlanData, FloorPlanZone, TableData } from "./types";
import type { StatusPaletteOverride } from "./status-colors";

export interface MultiZoneFloorPlanEditorProps {
  data: FloorPlanData;
  width?: number;
  height?: number;
  /** Ocupa el 100% del contenedor (responsive). */
  fill?: boolean;
  /** Escala/centra el plano para llenar el área (zoom-to-fit). */
  fitToContent?: boolean;
  defaultZoneId?: string;
  /** Se dispara al cambiar de zona (zoneId activo). */
  onZoneChange?: (zoneId: string) => void;
  /** Se dispara con el plano COMPLETO actualizado al mover/editar una mesa o estructura. */
  onChange?: (data: FloorPlanData) => void;
  /** Override de la paleta de estados. */
  palette?: StatusPaletteOverride;
}

/**
 * Editor multi-zona (admin): pestañas por zona. Mesas y estructuras arrastrables;
 * al soltar se actualizan sus coordenadas. Al SELECCIONAR una mesa (click) se abre
 * un panel lateral para editar sus atributos (nombre, capacidad, forma, sección, color).
 */
export function MultiZoneFloorPlanEditor({
  data,
  width = 800,
  height = 500,
  fill = false,
  fitToContent = false,
  defaultZoneId,
  onZoneChange,
  onChange,
  palette,
}: MultiZoneFloorPlanEditorProps) {
  const [zones, setZones] = useState<FloorPlanZone[]>(data.zones);
  const [activeZoneId, setActiveZoneId] = useState(defaultZoneId ?? data.zones[0]?.zoneId ?? "");
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  const activeZone = zones.find((z) => z.zoneId === activeZoneId) ?? zones[0];
  const selected = activeZone?.tables.find((t) => t.id === selectedId) ?? null;

  const handleZone = (id: string) => {
    setActiveZoneId(id);
    setSelectedId(null); // la mesa seleccionada no pertenece a la nueva zona
    onZoneChange?.(id);
  };

  const commit = (nextZones: FloorPlanZone[]) => {
    setZones(nextZones);
    onChange?.({ zones: nextZones });
  };

  /** Aplica un cambio parcial (posición o atributos) a una mesa de la zona activa. */
  const patchTable = (id: string | number, patch: Partial<TableData>) => {
    if (!activeZone) return;
    commit(
      zones.map((z) =>
        z.zoneId === activeZone.zoneId
          ? { ...z, tables: z.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
          : z,
      ),
    );
  };

  const handleTableDragEnd = (id: string | number, x: number, y: number) => patchTable(id, { x, y });

  const handleStructureDragEnd = (sid: string, x: number, y: number) => {
    if (!activeZone) return;
    commit(
      zones.map((z) =>
        z.zoneId === activeZone.zoneId
          ? { ...z, structures: (z.structures ?? []).map((s) => (s.id === sid ? { ...s, x, y } : s)) }
          : z,
      ),
    );
  };

  return (
    <div className={`flex flex-col gap-3 ${fill ? "h-full" : ""}`}>
      <Tabs value={activeZone?.zoneId} onValueChange={handleZone}>
        <TabsList>
          {zones.map((z) => (
            <TabsTrigger key={z.zoneId} value={z.zoneId}>
              {z.zoneName}
              <span className="ml-1.5 text-xs opacity-60">({z.tables.length})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeZone && (
        <div className={`flex gap-3 ${fill ? "min-h-0 flex-1" : ""}`}>
          <div className={fill ? "min-h-0 min-w-0 flex-1" : "min-w-0 flex-1"}>
            <FloorPlanCanvas
              tables={activeZone.tables}
              structures={activeZone.structures}
              width={width}
              height={height}
              fill={fill}
              fitToContent={fitToContent}
              zoneName={activeZone.zoneName}
              draggable
              onTableDragEnd={handleTableDragEnd}
              structureDraggable
              onStructureDragEnd={handleStructureDragEnd}
              selectedTableId={selectedId ?? undefined}
              onTableClick={(id) => setSelectedId(id)}
              palette={palette}
            />
          </div>
          {selected && (
            <TablePropertiesPanel
              table={selected}
              onPatch={(patch) => patchTable(selected.id, patch)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
