
export type TableStatus = "empty" | "available" | "occupied" | "reserved" | "cleaning" | "billing";

export type TableShapeKind = "circle" | "square" | "rect" | "diamond" | "banquette";

export interface TableData {
  id: string | number;

  number?: string | number;

  x: number;

  y: number;
  status: TableStatus;

  shape?: TableShapeKind;

  width?: number;
  height?: number;

  radius?: number;

  capacity?: number;

  server?: string;

  name?: string;

  color?: string;

  waiter?: string;

  waiterName?: string;

  hasReservation?: boolean;
}

export type StructureType = "wall" | "bar" | "column" | "entrance";

export interface StructureData {
  id: string;
  type: StructureType;
  x: number;
  y: number;
  width?: number;
  height?: number;

  label?: string;
}

export interface FloorPlanZone {
  zoneId: string;
  zoneName: string;
  tables: TableData[];

  structures?: StructureData[];
}

export interface FloorPlanData {
  zones: FloorPlanZone[];
}
