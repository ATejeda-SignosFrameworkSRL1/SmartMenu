"use client";

import { X } from "lucide-react";

import type { TableData, TableShapeKind } from "./types";

const SHAPES: { value: TableShapeKind; label: string }[] = [
  { value: "circle", label: "Círculo" },
  { value: "square", label: "Cuadrado" },
  { value: "rect", label: "Rectángulo" },
  { value: "diamond", label: "Diamante" },
  { value: "banquette", label: "Banqueta" },
];

export interface TablePropertiesPanelProps {
  table: TableData;

  onPatch: (patch: Partial<TableData>) => void;
  onClose: () => void;
}

export function TablePropertiesPanel({ table, onPatch, onClose }: TablePropertiesPanelProps) {
  const field =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-slate-500";
  const num = String(table.number ?? table.id);

  return (
    <aside className="flex w-60 flex-shrink-0 flex-col gap-3 overflow-auto rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Mesa {num}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className={labelCls}>Nombre / etiqueta</label>
        <input
          className={field}
          value={table.name ?? ""}
          maxLength={80}
          placeholder={`#${num}`}
          onChange={(e) => onPatch({ name: e.target.value })}
        />
      </div>

      <div>
        <label className={labelCls}>Capacidad</label>
        <input
          type="number"
          min={1}
          max={20}
          className={field}
          value={table.capacity ?? 1}
          onChange={(e) => onPatch({ capacity: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
        />
      </div>

      <div>
        <label className={labelCls}>Forma</label>
        <select className={field} value={table.shape ?? "circle"} onChange={(e) => onPatch({ shape: e.target.value as TableShapeKind })}>
          {SHAPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Sección (badge legado)</label>
        <input
          className={field}
          maxLength={3}
          value={table.server ?? ""}
          placeholder="—"
          onChange={(e) => onPatch({ server: e.target.value.toUpperCase() || undefined })}
        />
      </div>

      <div>
        <label className={labelCls}>Color de mesa</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
            value={table.color ?? "#2F9E78"}
            onChange={(e) => onPatch({ color: e.target.value })}
          />
          {table.color ? (
            <button
              type="button"
              onClick={() => onPatch({ color: undefined })}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              Quitar
            </button>
          ) : (
            <span className="text-xs text-slate-400">Usa color por estado</span>
          )}
        </div>
      </div>

      <p className="mt-auto text-[11px] leading-snug text-slate-400">Los cambios se guardan automáticamente.</p>
    </aside>
  );
}
