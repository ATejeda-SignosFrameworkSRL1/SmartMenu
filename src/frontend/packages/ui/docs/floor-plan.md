# SmartMenu — Floor Plan (resumen técnico)

> Estado del módulo de Plano de Planta para planificar la integración en tiempo real (SQL Server + WebSockets). Actualizado: 2026-06-16.

**Ubicación:** `src/frontend/packages/ui/src/components/floor-plan/` — paquete `@smartmenu/ui` (monorepo npm workspaces, Storybook 8 + Vite, `react-konva@^18`).

---

## 1. Tipos de TypeScript (`types.ts`)

```ts
// ── Mesa ──────────────────────────────────────────────
export type TableStatus = "empty" | "available" | "occupied" | "reserved" | "cleaning" | "billing";
export type TableShapeKind = "circle" | "square" | "rect" | "diamond" | "banquette";

export interface TableData {
  id: string | number;
  number?: string | number;   // etiqueta visible (ej. "S-1"); si falta usa id
  x: number;                   // centro X (px)
  y: number;                   // centro Y (px)
  status: TableStatus;
  shape?: TableShapeKind;      // default "circle"
  width?: number;              // rect/square/banquette; default 2*radius
  height?: number;
  radius?: number;             // circle; default 30
  capacity?: number;           // nº de sillas a dibujar — mapea a backend Table.Capacity
  server?: string;             // badge de mozo/sección ("FR" | "RO" | "KI")
}

// ── Estructura (elemento fijo) ────────────────────────
export type StructureType = "wall" | "bar" | "column" | "entrance";

export interface StructureData {
  id: string;
  type: StructureType;
  x: number;                   // ⚠ ORIGEN = esquina superior izquierda (no centro)
  y: number;
  width?: number;
  height?: number;
  label?: string;              // ej. "BAR", "ENTRADA"
}

// ── Zona + Plano ──────────────────────────────────────
export interface FloorPlanZone {
  zoneId: string;
  zoneName: string;
  tables: TableData[];
  structures?: StructureData[];
}

export interface FloorPlanData {
  zones: FloorPlanZone[];
}
```

**Tipos de apoyo (no-datos):**

- `chair-layout.ts`: `interface ChairTransform { x; y; rotation }` y
  `getChairLayout(shape: TableShapeKind, capacity: number, dims: { w; h; radius }): ChairTransform[]`
  (geometría de sillas: círculo radial, rect/cuadrado por lados, diamante por caras; evita el badge).
- `status-colors.ts`: `STATUS_COLORS: Record<TableStatus,{ fill; stroke; text; dash? }>`, `STATUS_LABELS`,
  `SERVER_COLORS: Record<string,string>` (FR=`#7C3AED`, RO=`#2563EB`, KI=`#16A34A`). **Solo presentación.**

> **Convención de origen (clave para la integración):** las **mesas** se posicionan por su **centro** (x,y); las **estructuras**, por su **esquina superior izquierda**.

---

## 2. Componentes (props + estructura)

| Componente | Props (TS) | Rol / estructura |
|---|---|---|
| **`TableShape`** | `id, x, y, status, isDraggable?, number?, shape?, width?, height?, radius?, server?, capacity?, onDragEnd?(id,x,y)` | Átomo de mesa. Un `<Group>` (origen=centro) que apila: **sillas** (detrás) → forma → número → **badge** de mozo (encima, top-left). Arrastrable como conjunto. |
| **`StructureShape`** | `...StructureData + isDraggable?, onDragEnd?(id,x,y)` | Átomo de estructura. `<Group>` (origen=top-left) que pinta según `type`: wall (rect gris claro `#E2E8F0`), bar (rect gris-azulado `#94A3B8` + `<Text>` mayúsculas), column (cuadradito), entrance (rect `dash:[4,4]` + label). En viewer `listening={false}`. |
| **`FloorPlanCanvas`** *(presentacional, base)* | `tables, structures?, width?=800, height?=500, zoneName?, draggable?, onTableDragEnd?, structureDraggable?, onStructureDragEnd?` | `Stage>Layer`. Orden de pintado: fondo → marca de agua (`zoneName`) → **estructuras (debajo)** → **mesas (encima)**. |
| **`FloorPlanViewer`** *(1 zona, host/waiter)* | `tables, structures?, width?, height?, zoneName?` | Solo lectura. Delega en `FloorPlanCanvas` con `draggable=false`. |
| **`FloorPlanEditor`** *(1 zona, admin)* | `initialTables, width?, height?, zoneName?, onChange?(tables)` | `useState(tables)`; `onDragEnd` actualiza x/y de la mesa y emite `onChange(tables)`. (No gestiona estructuras — eso es el multi-zona.) |
| **`MultiZoneFloorPlanViewer`** | `data: FloorPlanData, width?, height?, defaultZoneId?, onZoneChange?(zoneId)` | Pestañas (`Tabs` del DS) + `useState(activeZoneId)`. Renderiza `FloorPlanViewer` de la zona activa (tables+structures), read-only. |
| **`MultiZoneFloorPlanEditor`** | `data: FloorPlanData, width?, height?, defaultZoneId?, onChange?(data: FloorPlanData)` | Estado **elevado** de todas las zonas + zona activa. `handleTableDragEnd` / `handleStructureDragEnd` actualizan el elemento en la zona activa y emiten el `FloorPlanData` completo. |

---

## 3. Estado y lógica (Storybook)

- **Cambio de zona:** `Tabs` (Radix, controlado) ligado a `const [activeZoneId, setActiveZoneId] = useState(...)`. Al clic → `setActiveZoneId` → el lienzo renderiza `tables` + `structures` de esa zona. En **Viewer** el estado solo guarda la zona activa (datos read-only); en **Editor** se eleva el arreglo completo de `zones`, así las ediciones **persisten al cambiar de pestaña**.
- **Actualización de coordenadas:** el `onDragEnd` del `<Group>` lee `e.target.x()/y()` y reemplaza por `id` la mesa o estructura **dentro de la zona activa** (inmutable: `zones.map → tables/structures.map`), luego `setState` + `onChange(FloorPlanData)`.
- **Log de la derecha (story del Editor):** un `<div>` que recorre `data.zones` (el `FloorPlanData` emitido por `onChange`) y lista por zona: mesas `id: (x, y)` y estructuras `⛬ id [type]: (x, y)`. Es reflejo puro del estado — exactamente lo que se persistiría.

---

## 4. Esquema del JSON de mocks (`multi-zone-mock.ts`)

Forma = `FloorPlanData`. 4 zonas: **Salón Principal (8)**, **Terraza (8)**, **VIP (5)**, **Terraza Norte (6)**. Ejemplo de una zona (las otras 3 son idénticas en forma):

```jsonc
{
  "zones": [
    {
      "zoneId": "salon_principal",
      "zoneName": "Salón Principal",
      "tables": [
        { "id": "S-1", "number": "S-1", "x": 110, "y": 115, "shape": "circle",  "status": "available", "server": "FR", "capacity": 4 },
        { "id": "S-2", "number": "S-2", "x": 250, "y": 115, "shape": "square",  "status": "occupied",  "server": "FR", "width": 54, "height": 54, "capacity": 4 },
        { "id": "S-4", "number": "S-4", "x": 530, "y": 115, "shape": "diamond", "status": "reserved",  "server": "RO", "width": 54, "height": 54, "capacity": 4 },
        { "id": "S-8", "number": "S-8", "x": 530, "y": 255, "shape": "rect",    "status": "billing",   "server": "FR", "width": 46, "height": 78, "capacity": 6 }
        /* … 8 mesas en total … */
      ],
      "structures": [
        { "id": "sp-wall-top",  "type": "wall",     "x": 0,   "y": 52,  "width": 600, "height": 6 },
        { "id": "sp-entrance",  "type": "entrance", "x": 40,  "y": 49,  "width": 80,  "height": 6,  "label": "ENTRADA" },
        { "id": "sp-bar",       "type": "bar",      "x": 360, "y": 382, "width": 220, "height": 52, "label": "BAR" },
        { "id": "sp-col-1",     "type": "column",   "x": 300, "y": 168, "width": 16,  "height": 16 }
      ]
    }
    // { "zoneId": "terraza", … }  { "zoneId": "vip", … }  { "zoneId": "terraza_norte", … }
  ]
}
```

> Detalle del mock: el `capacity` lo inyecta un `.map` por forma (circle/square/diamond=4, rect/banquette=6) sobre los datos crudos; en producción vendría directo de la DB.

---

## 5. Notas de mapeo para la integración (DB + WebSocket)

- **DB ↔ tipos:** `TableData` ≈ fila de `Table` del backend (`Table.Capacity`→`capacity`, `Table.Status`→`status`, `Table.TableNumber`→`number`, `ZoneId`→zona).
  **Falta en la entidad `Table`** para persistir el layout: `PositionX/PositionY` (x,y), `Shape`, `Width/Height`, `Server` → **migración pendiente**.
  Las `structures` necesitarían tabla propia (`FloorStructure`: id, zoneId, type, x, y, width, height, label).
- **Lectura:** `GET /api/floorplan` → `FloorPlanData` tal cual (`zones[].tables[]` / `structures[]`).
- **Escritura (editor admin):** `MultiZoneFloorPlanEditor.onChange(data)` ya entrega el `FloorPlanData` completo → `PUT` del layout.
- **Tiempo real (host/waiter):** un evento WebSocket/SignalR por cambio de mesa → actualizás `table.status` (y/o asignación) en el estado del viewer → el color se recalcula solo (`STATUS_COLORS[status]`). No requiere recargar el lienzo.

---

## Mapa de archivos

```
packages/ui/src/components/floor-plan/
  types.ts                        # interfaces (sección 1)
  status-colors.ts                # STATUS_COLORS, STATUS_LABELS, SERVER_COLORS
  chair-layout.ts                 # getChairLayout() + ChairTransform
  table-shape.tsx                 # TableShape
  structure-shape.tsx             # StructureShape
  floor-plan-canvas.tsx           # lienzo base (Stage/Layer)
  floor-plan-viewer.tsx           # FloorPlanViewer (1 zona)
  floor-plan-editor.tsx           # FloorPlanEditor (1 zona)
  multi-zone-floor-plan-viewer.tsx
  multi-zone-floor-plan-editor.tsx
  multi-zone-mock.ts              # MULTI_ZONE_FLOOR_PLAN (4 zonas)
  bistro-tables.ts                # BISTRO_TABLES (demo plana)
  mock-tables.ts                  # MOCK_TABLES (demo simple)
  *.stories.tsx                   # TableShape, StructureShape, Capacidades, Bistro, Multi-Zona
```

Exportado por el barrel `@smartmenu/ui` (`src/index.ts`): componentes, tipos (`TableData`, `StructureData`, `FloorPlanZone`, `FloorPlanData`, `TableStatus`, `TableShapeKind`, `StructureType`), `getChairLayout`, `STATUS_COLORS`, `SERVER_COLORS`, y los mocks.
