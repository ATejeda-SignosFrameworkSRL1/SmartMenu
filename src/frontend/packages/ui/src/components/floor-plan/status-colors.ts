import type { TableStatus } from "./types";

export interface StatusColor {
  fill: string;
  stroke: string;
  text: string;
  /** Si true, la mesa se dibuja con borde punteado (estado libre). */
  dash?: boolean;
}

/**
 * Colores por estado para el lienzo Konva (color strings, no clases Tailwind).
 * Alineados con la convención de host-app (`getStatusStrip`).
 */
/**
 * Paleta sobria (grado dashboard): tonos algo desaturados y profundos en vez de
 * neón, para un look de software de reservas profesional (no "estilo Canva").
 */
export const STATUS_COLORS: Record<TableStatus, StatusColor> = {
  empty: { fill: "#F1F5F9", stroke: "#CBD5E1", text: "#94A3B8", dash: true }, // libre (punteado)
  available: { fill: "#2F9E78", stroke: "#268A67", text: "#FFFFFF" }, // esmeralda sobria
  occupied: { fill: "#D8565C", stroke: "#BC444A", text: "#FFFFFF" }, // rojo apagado
  reserved: { fill: "#E0A53E", stroke: "#C2862C", text: "#3E2C09" }, // oro/ámbar
  cleaning: { fill: "#5189CE", stroke: "#3F72B2", text: "#FFFFFF" }, // azul sereno
  billing: { fill: "#8B79C9", stroke: "#6F5DAE", text: "#FFFFFF" }, // violeta apagado
};

export const STATUS_LABELS: Record<TableStatus, string> = {
  empty: "Libre",
  available: "Disponible",
  occupied: "Ocupada",
  reserved: "Reservada",
  cleaning: "Limpieza",
  billing: "Por cobrar",
};

/** Map of TableStatus → display label; all fields required but overridable. */
export type StatusLabels = Record<TableStatus, string>;

/**
 * Merge a partial override over the default Spanish STATUS_LABELS.
 * Returns a complete StatusLabels object — missing keys fall back to Spanish.
 */
export function resolveStatusLabels(o?: Partial<StatusLabels>): StatusLabels {
  if (!o) return STATUS_LABELS;
  return { ...STATUS_LABELS, ...o };
}

/** Colores de badge por mozo/sección (estilo FR/RO/KI del screenshot de referencia). */
export const SERVER_COLORS: Record<string, string> = {
  FR: "#6E5CC0", // morado apagado
  RO: "#3F72C7", // azul apagado
  KI: "#2E9468", // verde apagado
};

export const DEFAULT_SERVER_COLOR = "#64748B";

/**
 * Paleta sobria para el badge del MESERO en vivo. Cada mesero recibe un color estable
 * por hash de sus iniciales (mismo estilo apagado del resto del plano).
 */
export const WAITER_BADGE_PALETTE: string[] = [
  "#6E5CC0", // morado
  "#3F72C7", // azul
  "#2E9468", // verde
  "#C2862C", // ámbar
  "#BC444A", // rojo apagado
  "#0E7490", // teal
  "#9D5BA6", // magenta apagado
  "#577590", // azul gris
];

/** Color estable por mesero: hash determinista de la clave (iniciales) → paleta. */
export function waiterColor(key: string | number | null | undefined): string {
  const s = String(key ?? "");
  if (!s) return DEFAULT_SERVER_COLOR;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return WAITER_BADGE_PALETTE[h % WAITER_BADGE_PALETTE.length];
}

/* ── Paleta de estados configurable (override por restaurante) ────────────── */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").trim();
  if (m.length !== 6) return null;
  const n = parseInt(m, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");

/** Oscurece un hex (deriva el borde a partir del relleno). */
export function darken(hex: string, factor = 0.82): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `#${toHex(rgb[0] * factor)}${toHex(rgb[1] * factor)}${toHex(rgb[2] * factor)}`;
}

/** Texto legible (oscuro/claro) según la luminancia del fondo. */
export function contrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum > 0.62 ? "#1f2937" : "#ffffff";
}

/** Override de paleta: un fill (hex) por estado. */
export type StatusPaletteOverride = Partial<Record<TableStatus, string>>;

/** Mezcla el override (fills) sobre STATUS_COLORS, derivando stroke y texto. */
export function resolveStatusColors(override?: StatusPaletteOverride | null): Record<TableStatus, StatusColor> {
  if (!override) return STATUS_COLORS;
  const out = {} as Record<TableStatus, StatusColor>;
  (Object.keys(STATUS_COLORS) as TableStatus[]).forEach((s) => {
    const fill = override[s];
    out[s] = fill && fill.trim()
      ? { fill, stroke: darken(fill), text: contrastText(fill), dash: STATUS_COLORS[s].dash }
      : STATUS_COLORS[s];
  });
  return out;
}
