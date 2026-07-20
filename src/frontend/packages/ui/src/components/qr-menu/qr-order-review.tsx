"use client";

// QR-ORDER-REVIEW (PROTOTIPO) — pantalla "Agregar a mi Orden" del cliente: revision
// de la orden antes de sumarla a la existente (Tus Platos, Instrucciones Especiales,
// Tu orden detallada, Resumen fiscal). Aqui vive el boton VISUAL "Para llevar" junto
// al boton "Agregar a mi Orden" (placeholder de diseno, sin funcion, segun lo pedido).
// PRESENTACIONAL: estado local + mocks; sin APIs ni BD.

import { useState } from "react";
import { ArrowLeft, DollarSign, Minus, Plus, Sparkles, Trash2 } from "lucide-react";

import { cn } from "../../lib/cn";
import { Button } from "../button";
import { MOCK_QR_MENU } from "./mock-menu";
import type { QrMenuCartLine } from "./types";

const TAX_RATE = 0.18;
const TIP_RATE = 0.10;

const money = (n: number) =>
  `RD$${Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

export interface QrOrderReviewProps {
  initialLines?: QrMenuCartLine[];
  className?: string;
}

export function QrOrderReview({ initialLines, className }: QrOrderReviewProps) {
  const [lines, setLines] = useState<QrMenuCartLine[]>(
    initialLines ?? [{ dish: MOCK_QR_MENU.find((d) => d.dishId === 1)!, quantity: 1, takeaway: false }],
  );
  const [instructions, setInstructions] = useState("");

  const subtotal = lines.reduce((s, l) => s + l.dish.price * l.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const tip = Math.round(subtotal * TIP_RATE * 100) / 100;
  const total = subtotal + tax + tip;

  const changeQty = (i: number, delta: number) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className={cn("mx-auto max-w-3xl", className)}>
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <button aria-label="Volver" className="rounded-full p-1 hover:bg-muted/50">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <Sparkles className="h-5 w-5 text-amber-400" /> Agregar a mi Orden
            </h1>
            <p className="text-xs text-muted-foreground">Se sumará a tu orden existente</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" type="button">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver al menú
        </Button>
      </div>

      <div className="space-y-5">
        {/* ── Tus Platos ── */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Tus Platos</h2>
          <div className="space-y-4">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{l.dish.name}</p>
                  <p className="text-xs text-muted-foreground">{money(l.dish.price)} c/u</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" className="h-8 w-8 rounded-full p-0"
                            onClick={() => changeQty(i, -1)} aria-label="Quitar uno">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-4 text-center font-bold">{l.quantity}</span>
                    <Button size="sm" variant="secondary" className="h-8 w-8 rounded-full p-0"
                            onClick={() => changeQty(i, 1)} aria-label="Agregar uno">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="w-24 text-right font-bold">{money(l.dish.price * l.quantity)}</span>
                  <button onClick={() => removeLine(i)} aria-label="Eliminar"
                          className="rounded-lg p-1 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Instrucciones Especiales ── */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Instrucciones Especiales</h2>
          <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                    placeholder="¿Alguna instrucción especial para tu orden? (opcional)"
                    className="w-full resize-none rounded-xl border bg-card px-4 py-3 text-sm" />
        </div>

        {/* ── Tu orden detallada ── */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">Tu orden detallada</h2>
          <p className="mb-3 text-xs text-muted-foreground">Revisa que todo esté correcto antes de confirmar</p>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm"><span className="font-bold text-primary">{l.quantity}x</span> <span className="font-semibold">{l.dish.name}</span></p>
                  <p className="text-[11px] text-muted-foreground">{money(l.dish.price)} c/u</p>
                </div>
                <span className="font-bold">{money(l.dish.price * l.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Resumen ── */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Resumen</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>ITBIS (18%)</span><span>{money(tax)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Propina Legal (10%)</span><span>{money(tip)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-lg font-extrabold">
              <span>Total</span><span>{money(total)}</span>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-blue-50 px-4 py-2.5 text-[11px] text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            <b>Nota:</b> La propina legal del 10% es obligatoria según la Ley 13-07 de RD
          </p>
        </div>

        {/* ── Footer: "Agregar a mi Orden" + "Para llevar" al lado (visual, sin funcion) ── */}
        <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row">
          {/* Boton visual "Para llevar" — placeholder de diseno, sin funcion. */}
          <Button variant="outline" size="lg" type="button" className="sm:w-52">
             Para llevar
          </Button>
          <Button size="lg" className="flex-1 bg-gradient-to-r from-blue-500 to-emerald-500 text-base font-bold hover:from-blue-600 hover:to-emerald-600">
            <DollarSign className="mr-2 h-5 w-5" /> Agregar a mi Orden
          </Button>
        </div>
      </div>
    </div>
  );
}
