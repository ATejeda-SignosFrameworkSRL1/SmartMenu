import type { TableShapeKind } from "./types";

export interface ChairTransform {
  x: number;
  y: number;

  rotation: number;
}

export const CHAIR_W = 14;
export const CHAIR_H = 7;
export const CHAIR_RADIUS = 2.5;
export const CHAIR_GAP = 5;
export const CHAIR_COLOR = "#cfd7e1";

const DEG = Math.PI / 180;

const OUT = CHAIR_GAP + CHAIR_H / 2;

function clampCapacity(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(12, Math.round(n));
}

function spread(count: number, from: number, to: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(from + to) / 2];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => from + step * i);
}

function circleChairs(n: number, r: number): ChairTransform[] {
  const dist = r + OUT;

  const start = 225 - 180 / n;
  return Array.from({ length: n }, (_, i) => {
    const a = start + (360 / n) * i;
    const rad = a * DEG;
    return { x: dist * Math.cos(rad), y: dist * Math.sin(rad), rotation: a + 90 };
  });
}

function rectChairs(n: number, w: number, h: number): ChairTransform[] {
  const halfW = w / 2;
  const halfH = h / 2;
  const offX = halfW + OUT;
  const offY = halfH + OUT;

  const nTB = Math.round((n * w) / (w + h));
  const nLR = n - nTB;
  const top = Math.ceil(nTB / 2);
  const bottom = nTB - top;
  const left = Math.ceil(nLR / 2);
  const right = nLR - left;

  const chairs: ChairTransform[] = [];

  spread(top, -halfW + 22, halfW - 10).forEach((x) => chairs.push({ x, y: -offY, rotation: 0 }));
  spread(bottom, -halfW + 10, halfW - 10).forEach((x) => chairs.push({ x, y: offY, rotation: 0 }));
  spread(left, -halfH + 12, halfH - 12).forEach((y) => chairs.push({ x: -offX, y, rotation: 90 }));
  spread(right, -halfH + 12, halfH - 12).forEach((y) => chairs.push({ x: offX, y, rotation: 90 }));
  return chairs;
}

function diamondChairs(n: number, d: number): ChairTransform[] {
  const s = Math.SQRT1_2;

  const faces = [
    { rot: -45, nx: s, ny: s, a: { x: d, y: 0 }, b: { x: 0, y: d } },
    { rot: 45, nx: s, ny: -s, a: { x: 0, y: -d }, b: { x: d, y: 0 } },
    { rot: 45, nx: -s, ny: s, a: { x: 0, y: d }, b: { x: -d, y: 0 } },
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
    default:
      return rectChairs(n, dims.w, dims.h);
  }
}
