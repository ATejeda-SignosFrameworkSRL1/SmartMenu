"use client";

import { Group, Circle, Rect, Text, Line } from "react-konva";
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

  isDraggable?: boolean;

  number?: string | number;

  shape?: TableShapeKind;

  width?: number;
  height?: number;
  radius?: number;

  server?: string;

  waiter?: string;

  hasReservation?: boolean;

  name?: string;

  color?: string;

  colors?: Record<TableStatus, StatusColor>;

  capacity?: number;

  isSelected?: boolean;

  onSelect?: (id: string | number) => void;

  onDragEnd?: (id: string | number, x: number, y: number) => void;
}

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
  hasReservation = false,
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

      {hasReservation && (
        <Group x={halfW * 0.78} y={-halfH * 0.78} listening={false}>
          <Circle radius={9} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} shadowColor="#0f172a" shadowBlur={2} shadowOpacity={0.25} />

          <Line points={[0, 0, 0, -4]} stroke="#ffffff" strokeWidth={1.4} lineCap="round" />
          <Line points={[0, 0, 3, 0.5]} stroke="#ffffff" strokeWidth={1.4} lineCap="round" />
        </Group>
      )}
    </Group>
  );
}
