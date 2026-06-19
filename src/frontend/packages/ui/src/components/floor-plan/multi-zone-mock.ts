import type { FloorPlanData } from "./types";

/**
 * Mock multi-zona alineado EXACTAMENTE con las mesas reales de la app: 27 mesas con
 * números globales 1-27 y los conteos reales por zona, pero con el diseño a mano
 * (posiciones, formas, estructuras BAR/ENTRADA/paredes, badges de mozo). El mapeo
 * diseño↔BD es 1:1 por número de mesa (`number`/`id` = número real; `zoneId` = id real de la zona).
 *
 *   Terraza (1): 1-8 · Salón Principal (2): 9-16 · VIP (3): 17-24 · Terraza Norte (4): 25-27
 *
 * Los `status` aquí son ilustrativos para el Storybook; en producción el estado real
 * (ocupada/reservada/…) lo superpone `useFloorPlanLive` vía /api/floorplan + /hubs/tables.
 */
export const MULTI_ZONE_FLOOR_PLAN: FloorPlanData = {
  zones: [
    {
      zoneId: "1",
      zoneName: "Terraza",
      tables: [
        { id: 1, number: 1, x: 120, y: 130, shape: "circle", status: "available", server: "KI", capacity: 4 },
        { id: 2, number: 2, x: 280, y: 130, shape: "circle", status: "empty", server: "KI", capacity: 2 },
        { id: 3, number: 3, x: 450, y: 130, shape: "rect", status: "occupied", waiter: "MR", server: "KI", capacity: 6, width: 120, height: 56 },
        { id: 4, number: 4, x: 610, y: 130, shape: "circle", status: "empty", server: "KI", capacity: 4 },
        { id: 5, number: 5, x: 120, y: 300, shape: "circle", status: "empty", server: "KI", capacity: 2 },
        { id: 6, number: 6, x: 290, y: 300, shape: "rect", status: "reserved", server: "KI", capacity: 6, width: 120, height: 56 },
        { id: 7, number: 7, x: 450, y: 300, shape: "circle", status: "available", server: "KI", capacity: 4 },
        { id: 8, number: 8, x: 610, y: 300, shape: "square", status: "empty", server: "KI", capacity: 2, width: 50, height: 50 },
      ],
      structures: [
        { id: "tz-wall-top", type: "wall", x: 20, y: 20, width: 640, height: 6 },
        { id: "tz-wall-left", type: "wall", x: 20, y: 20, width: 6, height: 360 },
        { id: "tz-entrance", type: "entrance", x: 520, y: 17, width: 90, height: 6, label: "ENTRADA" },
      ],
    },
    {
      zoneId: "2",
      zoneName: "Salón Principal",
      tables: [
        { id: 9, number: 9, x: 110, y: 115, shape: "circle", status: "available", server: "FR", capacity: 4 },
        { id: 10, number: 10, x: 250, y: 115, shape: "square", status: "occupied", waiter: "JP", server: "FR", capacity: 2, width: 50, height: 50 },
        { id: 11, number: 11, x: 410, y: 115, shape: "rect", status: "empty", server: "RO", capacity: 6, width: 120, height: 56 },
        { id: 12, number: 12, x: 570, y: 115, shape: "diamond", status: "reserved", server: "RO", capacity: 4, width: 56, height: 56 },
        { id: 13, number: 13, x: 110, y: 255, shape: "circle", status: "occupied", waiter: "MR", server: "RO", capacity: 2 },
        { id: 14, number: 14, x: 250, y: 255, shape: "rect", status: "empty", server: "FR", capacity: 6, width: 120, height: 56 },
        { id: 15, number: 15, x: 410, y: 255, shape: "circle", status: "available", server: "RO", capacity: 4 },
        { id: 16, number: 16, x: 570, y: 255, shape: "square", status: "billing", waiter: "LC", server: "FR", capacity: 2, width: 50, height: 50 },
      ],
      structures: [
        { id: "sp-wall-top", type: "wall", x: 0, y: 52, width: 640, height: 6 },
        { id: "sp-entrance", type: "entrance", x: 40, y: 49, width: 80, height: 6, label: "ENTRADA" },
        { id: "sp-bar", type: "bar", x: 360, y: 382, width: 220, height: 52, label: "BAR" },
        { id: "sp-col-1", type: "column", x: 320, y: 175, width: 16, height: 16 },
      ],
    },
    {
      zoneId: "3",
      zoneName: "VIP",
      tables: [
        { id: 17, number: 17, x: 130, y: 130, shape: "circle", status: "occupied", waiter: "JP", server: "RO", capacity: 4 },
        { id: 18, number: 18, x: 300, y: 130, shape: "square", status: "available", server: "RO", capacity: 2, width: 52, height: 52 },
        { id: 19, number: 19, x: 500, y: 130, shape: "banquette", status: "reserved", server: "RO", capacity: 6, width: 160, height: 60 },
        { id: 20, number: 20, x: 650, y: 130, shape: "diamond", status: "empty", server: "RO", capacity: 4, width: 56, height: 56 },
        { id: 21, number: 21, x: 130, y: 290, shape: "circle", status: "empty", server: "RO", capacity: 2 },
        { id: 22, number: 22, x: 320, y: 290, shape: "banquette", status: "billing", waiter: "LC", server: "RO", capacity: 6, width: 160, height: 60 },
        { id: 23, number: 23, x: 520, y: 290, shape: "square", status: "available", server: "RO", capacity: 4, width: 58, height: 58 },
        { id: 24, number: 24, x: 660, y: 290, shape: "circle", status: "empty", server: "RO", capacity: 2 },
      ],
      structures: [
        { id: "vip-wall", type: "wall", x: 0, y: 60, width: 8, height: 360 },
        { id: "vip-bar", type: "bar", x: 320, y: 400, width: 200, height: 52, label: "VIP BAR" },
      ],
    },
    {
      zoneId: "4",
      zoneName: "Terraza Norte",
      tables: [
        { id: 25, number: 25, x: 180, y: 180, shape: "circle", status: "available", server: "FR", capacity: 2 },
        { id: 26, number: 26, x: 380, y: 180, shape: "square", status: "occupied", waiter: "MR", server: "FR", capacity: 4, width: 58, height: 58 },
        { id: 27, number: 27, x: 600, y: 200, shape: "banquette", status: "reserved", server: "FR", capacity: 8, width: 190, height: 78 },
      ],
      structures: [
        { id: "tn-wall-top", type: "wall", x: 60, y: 70, width: 560, height: 6 },
        { id: "tn-entrance", type: "entrance", x: 300, y: 67, width: 90, height: 6, label: "ENTRADA" },
      ],
    },
  ],
};
