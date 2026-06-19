"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Line, Group } from "react-konva";

import { TableShape } from "./table-shape";
import { StructureShape } from "./structure-shape";
import type { TableData, StructureData } from "./types";
import { resolveStatusColors, type StatusPaletteOverride } from "./status-colors";

/** Separación de la grilla de fondo (px). */
const GRID = 40;
/** Margen extra alrededor de cada mesa (sillas + badge) al calcular el encuadre. */
const TABLE_PAD = 26;

export interface FloorPlanCanvasProps {
  tables: TableData[];
  /** Elementos fijos (paredes, barra, columnas, entradas). Se dibujan DEBAJO de las mesas. */
  structures?: StructureData[];
  width?: number;
  height?: number;
  /** Marca de agua centrada (ej. nombre de la zona). */
  zoneName?: string;
  /** Grilla sutil de fondo (blueprint). Default true. */
  showGrid?: boolean;
  /** Si true, el lienzo ocupa el 100% de su contenedor (mide con ResizeObserver). */
  fill?: boolean;
  /** Si true, escala/centra el plano para llenar el área disponible (zoom-to-fit). */
  fitToContent?: boolean;
  /** Si true, las mesas se pueden arrastrar. */
  draggable?: boolean;
  onTableDragEnd?: (id: string | number, x: number, y: number) => void;
  /** Si true, las estructuras se pueden arrastrar (modo editor). */
  structureDraggable?: boolean;
  onStructureDragEnd?: (id: string, x: number, y: number) => void;
  /** Mesa resaltada (glow). */
  selectedTableId?: string | number;
  /** Click sobre una mesa (para seleccionarla). */
  onTableClick?: (id: string | number) => void;
  /** Override de la paleta de estados (fills por estado). */
  palette?: StatusPaletteOverride;
}

/** Semi-extensión (mitad de ancho/alto) de una mesa según su forma. */
function tableHalfExtent(t: TableData): { hw: number; hh: number } {
  const r = t.radius ?? 30;
  switch (t.shape) {
    case "rect":
    case "square":
    case "banquette":
      return { hw: (t.width ?? r * 2) / 2, hh: (t.height ?? r * 2) / 2 };
    case "diamond":
      return { hw: (t.width ?? r * 2) / 2, hh: (t.height ?? t.width ?? r * 2) / 2 };
    default:
      return { hw: r, hh: r };
  }
}

/**
 * Lienzo Konva presentacional. Orden de pintado: fondo → grilla → marca de agua →
 * [grupo con encuadre] estructuras (debajo) → mesas (encima). Base de Viewer/Editor.
 *
 * Con `fill` mide su contenedor y ocupa todo el espacio; con `fitToContent` escala
 * y centra el plano para llenar el área (sin franjas blancas muertas).
 */
export function FloorPlanCanvas({
  tables,
  structures,
  width,
  height,
  zoneName,
  showGrid = true,
  fill = false,
  fitToContent = false,
  draggable = false,
  onTableDragEnd,
  structureDraggable = false,
  onStructureDragEnd,
  selectedTableId,
  onTableClick,
  palette,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number }>(() =>
    fill ? { w: 0, h: 0 } : { w: width ?? 800, h: height ?? 520 },
  );

  useEffect(() => {
    if (!fill || !containerRef.current) return;
    const el = containerRef.current;
    const update = () => setMeasured({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const w = fill ? measured.w : width ?? 800;
  const h = fill ? measured.h : height ?? 520;

  // Encuadre (zoom-to-fit): bbox del contenido → escala + centrado.
  const fitGroup = useMemo(() => {
    if (!fitToContent || w <= 0 || h <= 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of tables) {
      const { hw, hh } = tableHalfExtent(t);
      minX = Math.min(minX, t.x - hw - TABLE_PAD);
      maxX = Math.max(maxX, t.x + hw + TABLE_PAD);
      minY = Math.min(minY, t.y - hh - TABLE_PAD);
      maxY = Math.max(maxY, t.y + hh + TABLE_PAD);
    }
    for (const s of structures ?? []) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x + (s.width ?? 0));
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y + (s.height ?? 0));
    }
    if (!Number.isFinite(minX)) return null;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const pad = 40;
    const raw = Math.min((w - pad * 2) / contentW, (h - pad * 2) / contentH);
    const scale = Math.max(0.2, Math.min(1.8, raw));
    return {
      x: w / 2,
      y: h / 2,
      offsetX: (minX + maxX) / 2,
      offsetY: (minY + maxY) / 2,
      scaleX: scale,
      scaleY: scale,
    };
  }, [fitToContent, w, h, tables, structures]);

  const gridLines: number[][] = [];
  if (showGrid && w > 0 && h > 0) {
    for (let gx = GRID; gx < w; gx += GRID) gridLines.push([gx, 0, gx, h]);
    for (let gy = GRID; gy < h; gy += GRID) gridLines.push([0, gy, w, gy]);
  }

  const colors = useMemo(() => resolveStatusColors(palette), [palette]);

  const content = (
    <>
      {/* Estructuras DEBAJO de las mesas para que no las tapen. */}
      {(structures ?? []).map((s) => (
        <StructureShape key={s.id} {...s} isDraggable={structureDraggable} onDragEnd={onStructureDragEnd} />
      ))}

      {tables.map((t) => (
        <TableShape
          key={t.id}
          id={t.id}
          x={t.x}
          y={t.y}
          status={t.status}
          number={t.number}
          shape={t.shape}
          width={t.width}
          height={t.height}
          radius={t.radius}
          waiter={t.waiter}
          name={t.name}
          color={t.color}
          colors={colors}
          capacity={t.capacity}
          isDraggable={draggable}
          onDragEnd={onTableDragEnd}
          isSelected={selectedTableId != null && t.id === selectedTableId}
          onSelect={onTableClick}
        />
      ))}
    </>
  );

  return (
    <div ref={containerRef} style={fill ? { width: "100%", height: "100%" } : undefined}>
      {w > 0 && h > 0 && (
        <Stage width={w} height={h}>
          <Layer>
            <Rect x={0} y={0} width={w} height={h} fill="#f8fafc" cornerRadius={8} />
            {gridLines.map((pts, i) => (
              <Line key={`grid-${i}`} points={pts} stroke="#eef2f8" strokeWidth={1} listening={false} />
            ))}
            {zoneName && (
              <Text
                text={zoneName.toUpperCase()}
                fontSize={11}
                fontStyle="bold"
                letterSpacing={1.5}
                fill="#c2ccd9"
                x={16}
                y={14}
                listening={false}
              />
            )}

            {fitGroup ? <Group {...fitGroup}>{content}</Group> : content}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
