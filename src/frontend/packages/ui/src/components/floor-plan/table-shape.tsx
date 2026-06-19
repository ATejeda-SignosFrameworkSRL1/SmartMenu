"use client";

import { Group, Circle, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { STATUS_COLORS, waiterColor, contrastText, type StatusColor } from "./status-colors";
import { getChairLayout, CHAIR_W, CHAIR_H, CHAIR_RADIUS, CHAIR_COLOR } from "./chair-layout";
import type { TableShapeKind, TableStatus } from "./types";

const SELECT_COLOR = "#2563eb";

export interface TableShapeProps {
  id: string | number;
  x: number;
  y: number;
  status: TableStatus;
  /** Si true, la mesa se puede arrastrar (modo editor). */
  isDraggable?: boolean;
  /** Etiqueta visible (si difiere del id). */
  number?: string | number;
  /** Forma de la mesa. Default 'circle'. */
  shape?: TableShapeKind;
  /** Ancho/alto para formas no circulares (px). Default 2*radius. */
  width?: number;
  height?: number;
  radius?: number;
  /** Código de mozo/sección (legado). El badge usa `waiter`. */
  server?: string;
  /** Iniciales del MESERO en vivo a cargo (ej. "KI"); rige el badge superior izquierdo. */
  waiter?: string;
  /** Nombre/etiqueta visible (si difiere del número). */
  name?: string;
  /** Color manual de la mesa (hex). Sobrescribe el relleno por estado. */
  color?: string;
  /** Paleta de estados resuelta (default = STATUS_COLORS). */
  colors?: Record<TableStatus, StatusColor>;
  /** Capacidad (personas): dibuja esa cantidad de sillas alrededor de la mesa. */
  capacity?: number;
  /** Resalta la mesa (glow azul) cuando está seleccionada. */
  isSelected?: boolean;
  /** Click/tap sobre la mesa (para seleccionarla). */
  onSelect?: (id: string | number) => void;
  /** Se dispara al soltar la mesa (solo si isDraggable). */
  onDragEnd?: (id: string | number, x: number, y: number) => void;
}

/**
 * Una mesa en el plano, dibujada con react-konva. La forma depende de `shape`,
 * el color del `status`, muestra opcionalmente un badge de mozo/sección y dibuja
 * `capacity` sillas alrededor. Soporta selección (glow) y click. Todo va dentro de
 * un mismo `<Group>` (arrastrable en conjunto). Debe renderizarse dentro de un `<Layer>`.
 */
export function TableShape({
  id,
  x,
  y,
  status,
  isDraggable = false,
  number,
  shape = "circle",
  width,
  height,
  radius = 30,
  waiter,
  name,
  color,
  colors,
  capacity,
  isSelected = false,
  onSelect,
  onDragEnd,
}: TableShapeProps) {
  const sc = (colors ?? STATUS_COLORS)[status] ?? STATUS_COLORS.available;
  const customColor = color && color.trim() ? color : undefined;
  const fillColor = customColor ?? sc.fill;
  const textColor = customColor ? contrastText(customColor) : sc.text;
  const label = name && name.trim() ? name : number != null ? String(number) : String(id);

  const w = width ?? radius * 2;
  const h = height ?? radius * 2;
  const halfW = shape === "circle" ? radius : w / 2;
  const halfH = shape === "circle" ? radius : h / 2;

  const chairs = capacity ? getChairLayout(shape, capacity, { w, h, radius }) : [];

  const shapeProps = {
    fill: fillColor,
    stroke: isSelected ? SELECT_COLOR : sc.stroke,
    strokeWidth: isSelected ? 2.5 : 1.5,
    dash: sc.dash ? [5, 4] : undefined,
    shadowColor: isSelected ? SELECT_COLOR : "#0f172a",
    shadowBlur: isSelected ? 10 : sc.dash ? 0 : 4,
    shadowOpacity: isSelected ? 0.35 : 0.12,
    shadowOffsetY: isSelected ? 0 : 1,
  };

  let node: JSX.Element;
  if (shape === "circle") {
    node = <Circle radius={radius} {...shapeProps} />;
  } else if (shape === "diamond") {
    node = <Rect width={w} height={h} offsetX={w / 2} offsetY={h / 2} rotation={45} cornerRadius={3} {...shapeProps} />;
  } else {
    node = (
      <Rect
        width={w}
        height={h}
        offsetX={w / 2}
        offsetY={h / 2}
        cornerRadius={shape === "banquette" ? 20 : 6}
        {...shapeProps}
      />
    );
  }

  const labelW = shape === "circle" ? radius * 2 : w;
  const labelH = shape === "circle" ? radius * 2 : h;
  const badgeColor = waiter ? waiterColor(waiter) : undefined;

  const setCursor = (e: KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Group
      x={x}
      y={y}
      draggable={isDraggable}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => onDragEnd?.(id, e.target.x(), e.target.y())}
      onClick={onSelect ? () => onSelect(id) : undefined}
      onTap={onSelect ? () => onSelect(id) : undefined}
      onMouseEnter={onSelect ? (e) => setCursor(e, "pointer") : undefined}
      onMouseLeave={onSelect ? (e) => setCursor(e, "default") : undefined}
    >
      {/* Sillas PRIMERO (detrás de la mesa); el badge va último (encima) → nunca se tapa. */}
      {chairs.map((c, i) => (
        <Rect
          key={`chair-${i}`}
          x={c.x}
          y={c.y}
          rotation={c.rotation}
          width={CHAIR_W}
          height={CHAIR_H}
          offsetX={CHAIR_W / 2}
          offsetY={CHAIR_H / 2}
          cornerRadius={CHAIR_RADIUS}
          fill={CHAIR_COLOR}
          listening={false}
        />
      ))}

      {node}

      <Text
        text={label}
        fontSize={13}
        fontStyle="bold"
        letterSpacing={0.3}
        fill={textColor}
        width={labelW}
        height={labelH}
        offsetX={labelW / 2}
        offsetY={labelH / 2}
        align="center"
        verticalAlign="middle"
        listening={false}
      />

      {waiter && (
        <Group x={-halfW * 0.78} y={-halfH * 0.78} listening={false}>
          <Circle radius={10} fill={badgeColor} stroke="#ffffff" strokeWidth={1.5} shadowColor="#0f172a" shadowBlur={2} shadowOpacity={0.2} />
          <Text
            text={waiter}
            fontSize={8.5}
            fontStyle="bold"
            fill="#ffffff"
            width={20}
            height={20}
            offsetX={10}
            offsetY={10}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
    </Group>
  );
}
