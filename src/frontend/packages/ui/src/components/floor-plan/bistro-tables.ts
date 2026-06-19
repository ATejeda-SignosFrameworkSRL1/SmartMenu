import type { TableData, TableShapeKind } from "./types";

/**
 * Plano "Bistro" — datos mock que reproducen el lienzo del screenshot de referencia
 * (estilo resOS): formas variadas, mesas libres (punteadas) + ocupadas por color,
 * y badges de mozo/sección (FR / RO / KI). Canvas sugerido: 900 x 720.
 */
const BISTRO_RAW: TableData[] = [
  // ── Columna izquierda ──
  { id: "D-7", number: "D-7", x: 90, y: 85, shape: "square", status: "empty", server: "FR", width: 54, height: 54 },
  { id: "D-6", number: "D-6", x: 90, y: 195, shape: "circle", status: "available", server: "FR" },
  { id: "D-5", number: "D-5", x: 90, y: 290, shape: "circle", status: "cleaning", server: "FR" },
  { id: "D-4", number: "D-4", x: 90, y: 380, shape: "square", status: "available", server: "FR", width: 52, height: 52 },
  { id: "D-3", number: "D-3", x: 90, y: 475, shape: "circle", status: "occupied", server: "RO" },
  { id: "D-2", number: "D-2", x: 90, y: 580, shape: "square", status: "cleaning", server: "KI", width: 52, height: 52 },
  { id: "D-1", number: "D-1", x: 90, y: 670, shape: "circle", status: "cleaning", server: "KI" },

  // ── Segunda columna ──
  { id: "D-8", number: "D-8", x: 235, y: 115, shape: "square", status: "available", server: "FR", width: 50, height: 50 },
  { id: "D-28", number: "D-28", x: 245, y: 300, shape: "rect", status: "empty", server: "FR", width: 54, height: 130 },
  { id: "D-9", number: "D-9", x: 225, y: 445, shape: "diamond", status: "empty", server: "FR", width: 54, height: 54 },
  { id: "D-10", number: "D-10", x: 250, y: 535, shape: "diamond", status: "occupied", server: "FR", width: 56, height: 56 },
  { id: "D-11", number: "D-11", x: 225, y: 665, shape: "diamond", status: "empty", server: "KI", width: 54, height: 54 },

  // ── Columna central-izquierda ──
  { id: "D-12", number: "D-12", x: 385, y: 90, shape: "square", status: "empty", server: "FR", width: 56, height: 56 },
  { id: "D-29", number: "D-29", x: 405, y: 660, shape: "rect", status: "empty", server: "KI", width: 64, height: 120 },

  // ── Centro ──
  { id: "A-13", number: "A-13", x: 560, y: 110, shape: "square", status: "empty", width: 58, height: 58 },
  { id: "A-15", number: "A-15", x: 560, y: 335, shape: "diamond", status: "empty", width: 54, height: 54 },
  { id: "D-20", number: "D-20", x: 500, y: 470, shape: "square", status: "empty", server: "KI", width: 54, height: 54 },
  { id: "D-21", number: "D-21", x: 505, y: 620, shape: "square", status: "billing", server: "KI", width: 58, height: 58 },

  // ── Centro-derecha ──
  { id: "D-17", number: "D-17", x: 610, y: 460, shape: "rect", status: "empty", server: "RO", width: 46, height: 78 },
  { id: "D-18", number: "D-18", x: 610, y: 558, shape: "rect", status: "empty", server: "RO", width: 46, height: 66 },
  { id: "D-19", number: "D-19", x: 610, y: 658, shape: "rect", status: "empty", server: "RO", width: 46, height: 78 },
  { id: "D-25", number: "D-25", x: 690, y: 460, shape: "circle", status: "empty", server: "RO" },
  { id: "D-26", number: "D-26", x: 690, y: 552, shape: "circle", status: "empty", server: "RO" },
  { id: "D-27", number: "D-27", x: 690, y: 650, shape: "circle", status: "available", server: "RO" },

  // ── Derecha (área A) ──
  { id: "A-14", number: "A-14", x: 810, y: 95, shape: "square", status: "empty", width: 58, height: 58 },
  { id: "A-16", number: "A-16", x: 825, y: 255, shape: "square", status: "empty", width: 56, height: 56 },

  // ── Banco (banquette) derecho ──
  { id: "D-22", number: "D-22", x: 785, y: 465, shape: "square", status: "empty", server: "RO", width: 52, height: 52 },
  { id: "D-23", number: "D-23", x: 785, y: 560, shape: "square", status: "occupied", server: "RO", width: 52, height: 52 },
  { id: "D-24", number: "D-24", x: 785, y: 655, shape: "square", status: "cleaning", server: "RO", width: 52, height: 52 },
];

/** Capacidad por defecto según la forma (cada mesa puede sobreescribirla). */
const CAP_BY_SHAPE: Record<TableShapeKind, number> = {
  circle: 4,
  square: 4,
  rect: 6,
  diamond: 4,
  banquette: 6,
};

export const BISTRO_TABLES: TableData[] = BISTRO_RAW.map((t) => ({
  capacity: CAP_BY_SHAPE[t.shape ?? "circle"],
  ...t,
}));
