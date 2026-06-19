"use client";

import { Group, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";

import type { StructureData } from "./types";

const WALL_FILL = "#E2E8F0"; // gris claro (paredes/divisorias)
const BAR_FILL = "#94A3B8"; // gris azulado (barra)
const BAR_TEXT = "#FFFFFF";
const COLUMN_FILL = "#94A3B8"; // columna de soporte
const ENTRANCE_STROKE = "#94A3B8";
const ENTRANCE_TEXT = "#64748B";

export interface StructureShapeProps extends StructureData {
  /** Si true, la estructura se puede arrastrar (modo editor). */
  isDraggable?: boolean;
  onDragEnd?: (id: string, x: number, y: number) => void;
}

/**
 * Elemento fijo del plano (pared, barra, columna, entrada), dibujado con react-konva.
 * Origen = esquina superior izquierda. Va dentro de un `<Layer>`, DEBAJO de las mesas.
 */
export function StructureShape({
  id,
  type,
  x,
  y,
  width,
  height,
  label,
  isDraggable = false,
  onDragEnd,
}: StructureShapeProps) {
  // Defaults sensatos por tipo.
  const w = width ?? (type === "column" ? 18 : type === "wall" ? 120 : 200);
  const h = height ?? (type === "column" ? 18 : type === "wall" ? 8 : 60);

  let content: JSX.Element;
  switch (type) {
    case "bar":
      content = (
        <>
          <Rect width={w} height={h} fill={BAR_FILL} cornerRadius={8} shadowBlur={4} shadowOpacity={0.15} />
          <Text
            text={(label ?? "BAR").toUpperCase()}
            width={w}
            height={h}
            align="center"
            verticalAlign="middle"
            fill={BAR_TEXT}
            fontSize={14}
            fontStyle="bold"
            letterSpacing={2}
            listening={false}
          />
        </>
      );
      break;
    case "column":
      content = <Rect width={w} height={h} fill={COLUMN_FILL} cornerRadius={3} />;
      break;
    case "entrance":
      content = (
        <>
          <Rect width={w} height={h} stroke={ENTRANCE_STROKE} strokeWidth={1.5} dash={[4, 4]} cornerRadius={2} />
          <Text
            text={(label ?? "ENTRADA").toUpperCase()}
            x={0}
            y={h + 2}
            width={w}
            align="center"
            fill={ENTRANCE_TEXT}
            fontSize={9}
            letterSpacing={1}
            listening={false}
          />
        </>
      );
      break;
    case "wall":
    default:
      content = <Rect width={w} height={h} fill={WALL_FILL} cornerRadius={2} />;
      break;
  }

  return (
    <Group
      x={x}
      y={y}
      draggable={isDraggable}
      // En modo viewer no escucha eventos: decorativo y no bloquea las mesas.
      listening={isDraggable}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => onDragEnd?.(id, e.target.x(), e.target.y())}
    >
      {content}
    </Group>
  );
}
