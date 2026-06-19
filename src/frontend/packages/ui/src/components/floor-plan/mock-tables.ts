import type { TableData } from "./types";

/** Datos mock para Storybook: 6 mesas con posiciones y estados variados. */
export const MOCK_TABLES: TableData[] = [
  { id: 1, number: 1, x: 120, y: 110, status: "available", capacity: 4 },
  { id: 2, number: 2, x: 300, y: 110, status: "occupied", capacity: 2 },
  { id: 3, number: 3, x: 480, y: 110, status: "reserved", capacity: 6 },
  { id: 4, number: 4, x: 120, y: 280, status: "cleaning", capacity: 4 },
  { id: 5, number: 5, x: 300, y: 280, status: "billing", capacity: 2 },
  { id: 6, number: 6, x: 480, y: 280, status: "available", capacity: 8 },
];
