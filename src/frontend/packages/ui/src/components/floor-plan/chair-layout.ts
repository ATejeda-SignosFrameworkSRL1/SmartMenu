import type { TableShapeKind } from "./types";

/** Transformación de una silla, relativa al CENTRO de la mesa (origen del Group). */
export interface ChairTransform {
  x: number;
  y: number;
  /** Rotación en grados. */
  rotation: number;
}

export const CHAIR_W = 14;
export const CHAIR_H = 7;
export const CHAIR_RADIUS = 2.5;
export const CHAIR_GAP = 5;
export const CHAIR_COLOR = "#cfd7e1";

const DEG = Math.PI / 180;
/** Distancia perpendicular del borde de la mesa al centro de la silla. */
const OUT = CHAIR_GAP + CHAIR_H / 2;

function clampCapacity(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(12, Math.round(n));
}

/** Distribuye `count` posiciones equidistantes en [from, to] (centradas si count===1). */
function spread(count: number, from: number, to: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(from + to) / 2];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => from + step * i);
}

/** Sillas radiales equidistantes alrededor de un círculo. */
function circleChairs(n: number, r: number): ChairTransform[] {
  const dist = r + OUT;
  // Centra un HUECO frente al badge (~225°, arriba-izq) para no interferir.
  const start = 225 - 180 / n;
  return Array.from({ length: n }, (_, i) => {
    const a = start + (360 / n) * i;
    const rad = a * DEG;
    return { x: dist * Math.cos(rad), y: dist * Math.sin(rad), rotation: a + 90 };
  });
}

/** Sillas en los 4 lados de un rect/cuadrado, favoreciendo los lados largos. */
function rectChairs(n: number, w: number, h: number): ChairTransform[] {
  const halfW = w / 2;
  const halfH = h / 2;
  const offX = halfW + OUT;
  const offY = halfH + OUT;

  const nTB = Math.round((n * w) / (w + h)); // sillas arriba+abajo
  const nLR = n - nTB; // sillas izq+der
  const top = Math.ceil(nTB / 2);
  const bottom = nTB - top;
  const left = Math.ceil(nLR / 2);
  const right = nLR - left;

  const chairs: ChairTransform[] = [];
  // Lado superior: inset izquierdo mayor (22) para DESPEJAR el badge (esquina sup-izq).
  spread(top, -halfW + 22, halfW - 10).forEach((x) => chairs.push({ x, y: -offY, rotation: 0 }));
  spread(bottom, -halfW + 10, halfW - 10).forEach((x) => chairs.push({ x, y: offY, rotation: 0 }));
  spread(left, -halfH + 12, halfH - 12).forEach((y) => chairs.push({ x: -offX, y, rotation: 90 }));
  spread(right, -halfH + 12, halfH - 12).forEach((y) => chairs.push({ x: offX, y, rotation: 90 }));
  return chairs;
}

/** Sillas paralelas a las caras inclinadas del diamante (se omite la cara sup-izq del badge). */
function diamondChairs(n: number, d: number): ChairTransform[] {
  const s = Math.SQRT1_2; // 1/√2
  // 3 caras (sin la superior-izquierda, donde vive el badge), round-robin.
  const faces = [
    { rot: -45, nx: s, ny: s, a: { x: d, y: 0 }, b: { x: 0, y: d } }, // inferior-derecha
    { rot: 45, nx: s, ny: -s, a: { x: 0, y: -d }, b: { x: d, y: 0 } }, // superior-derecha
    { rot: 45, nx: -s, ny: s, a: { x: 0, y: d }, b: { x: -d, y: 0 } }, // inferior-izquierda
  ];
  const perFace = [0, 0, 0];
  for (let i = 0; i < n; i++) perFace[i % 3]++;

  const chairs: ChairTransform[] = [];
  faces.forEach((f, fi) => {
    const count = perFace[fi];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : 0.28 + (0.44 * i) / (count - 1);
      const mx = f.a.x + (f.b.x - f.a.x) * t;
      const my = f.a.y + (f.b.y - f.a.y) * t;
      chairs.push({ x: mx + f.nx * OUT, y: my + f.ny * OUT, rotation: f.rot });
    }
  });
  return chairs;
}

/**
 * Calcula las posiciones de las sillas alrededor de una mesa según su forma y
 * capacidad. Las coordenadas son relativas al centro de la mesa (origen del Group).
 */
export function getChairLayout(
  shape: TableShapeKind,
  capacity: number,
  dims: { w: number; h: number; radius: number },
): ChairTransform[] {
  const n = clampCapacity(capacity);
  if (n === 0) return [];
  switch (shape) {
    case "circle":
      return circleChairs(n, dims.radius);
    case "diamond":
      return diamondChairs(n, dims.w / 2);
    default: // square, rect, banquette
      return rectChairs(n, dims.w, dims.h);
  }
}
