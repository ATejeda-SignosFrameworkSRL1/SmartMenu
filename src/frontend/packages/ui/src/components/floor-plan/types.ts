/** Estado de una mesa. 'empty' = libre (se dibuja con borde punteado). */
export type TableStatus = "empty" | "available" | "occupied" | "reserved" | "cleaning" | "billing";

/** Forma de la mesa en el lienzo. */
export type TableShapeKind = "circle" | "square" | "rect" | "diamond" | "banquette";

/** Una mesa en el plano: identidad, posición, forma y estado. */
export interface TableData {
  id: string | number;
  /** Etiqueta visible (ej. "D-12", "A-15"). Si se omite, se usa el id. */
  number?: string | number;
  /** Coordenada X (centro) en el lienzo (px). */
  x: number;
  /** Coordenada Y (centro) en el lienzo (px). */
  y: number;
  status: TableStatus;
  /** Forma. Default 'circle'. */
  shape?: TableShapeKind;
  /** Ancho/alto para formas rect/square/banquette (px). Default 2*radius. */
  width?: number;
  height?: number;
  /** Radio para 'circle' (px). Default 30. */
  radius?: number;
  /** Capacidad (personas) — define cuántas sillas se dibujan. Alineado con backend Table.Capacity. */
  capacity?: number;
  /** Código de mozo/sección (legado de diseño). El badge ahora usa `waiter`. */
  server?: string;
  /** Nombre/etiqueta visible de la mesa (si difiere del número). */
  name?: string;
  /** Color manual de la mesa (hex). Sobrescribe el relleno por estado. */
  color?: string;
  /** Iniciales del MESERO en vivo a cargo de la mesa (ej. "KI"). Rige el badge. */
  waiter?: string;
  /** Nombre completo del mesero a cargo (para tooltip). */
  waiterName?: string;
}

/** Tipo de elemento arquitectónico/ambiental fijo del plano. */
export type StructureType = "wall" | "bar" | "column" | "entrance";

/**
 * Elemento fijo del plano (pared, barra, columna, entrada).
 * A diferencia de las mesas (origen = centro), el origen es la ESQUINA SUPERIOR IZQUIERDA.
 */
export interface StructureData {
  id: string;
  type: StructureType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Texto opcional (ej. "BAR", "ENTRADA"). */
  label?: string;
}

/** Una zona del restaurante con sus mesas y sus elementos fijos (ej. "Salón Principal"). */
export interface FloorPlanZone {
  zoneId: string;
  zoneName: string;
  tables: TableData[];
  /** Elementos arquitectónicos/ambientación de la zona. */
  structures?: StructureData[];
}

/** Plano multi-zona: la forma en que llegarían los datos desde SQL Server. */
export interface FloorPlanData {
  zones: FloorPlanZone[];
}
