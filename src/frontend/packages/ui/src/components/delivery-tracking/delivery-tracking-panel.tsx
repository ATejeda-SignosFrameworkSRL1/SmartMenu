"use client";

import { useMemo, useState } from "react";
import {
  Truck, Package, PackageX, ChevronDown, ChevronUp, MapPin, Phone, Loader2, Store,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { Switch } from "../switch";
import { Badge } from "../badge";
import { Button } from "../button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../select";
import {
  DELIVERY_NEXT_STATUS,
  DELIVERY_STATUS_LABELS,
  type DeliveryInvoice,
  type DeliveryStatusKey,
} from "./types";

const STATUS_STYLE: Record<DeliveryStatusKey, { badge: string; dot: string }> = {
  Pending:        { badge: "bg-amber-50 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
  Confirmed:      { badge: "bg-blue-50 text-blue-700 border-blue-200",        dot: "bg-blue-500" },
  Preparing:      { badge: "bg-orange-50 text-orange-700 border-orange-200",  dot: "bg-orange-500" },
  ReadyForPickup: { badge: "bg-violet-50 text-violet-700 border-violet-200",  dot: "bg-violet-500" },
  OutForDelivery: { badge: "bg-cyan-50 text-cyan-700 border-cyan-200",        dot: "bg-cyan-500" },
  Delivered:      { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Cancelled:      { badge: "bg-red-50 text-red-600 border-red-200",           dot: "bg-red-500" },
};

const money = (n: number) =>
  `RD$ ${Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

function StatusBadge({ status }: { status: DeliveryStatusKey }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Pending;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
      s.badge,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {DELIVERY_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export interface DeliveryTrackingPanelProps {

  enabled: boolean | null;
  onToggleEnabled?: (next: boolean) => void;
  invoices: DeliveryInvoice[];

  onAdvanceStatus?: (invoiceId: number, next: DeliveryStatusKey) => void;

  updatingId?: number | null;
  className?: string;
}

export function DeliveryTrackingPanel({
  enabled,
  onToggleEnabled,
  invoices,
  onAdvanceStatus,
  updatingId = null,
  className,
}: DeliveryTrackingPanelProps) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const visible = useMemo(
    () => (filter === "all" ? invoices : invoices.filter((i) => i.deliveryStatus === filter)),
    [invoices, filter],
  );

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className={cn("space-y-6", className)}>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Seguimiento de Delivery</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Estado de entregas y pedidos para llevar — una factura, una orden por franquicia
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card px-5 py-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Seguimiento de delivery habilitado</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? "El seguimiento está activo. Las facturas en curso aparecen abajo."
                       : "El seguimiento está desactivado. Actívalo para ver las entregas."}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled === true}
          disabled={enabled === null}
          onCheckedChange={(v) => onToggleEnabled?.(v)}
          aria-label="Seguimiento de delivery habilitado"
        />
      </div>

      {enabled !== true ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/30 py-24 text-muted-foreground">
          <PackageX className="h-12 w-12 opacity-30" />
          <p className="font-medium">Seguimiento de delivery deshabilitado</p>
          <p className="max-w-md text-center text-sm">
            Activa el interruptor de arriba para empezar a rastrear las entregas y pedidos para llevar.
          </p>
        </div>
      ) : (
        <>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Filtrar por estado:</span>
            <div className="w-56">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatusKey[]).map((s) => (
                    <SelectItem key={s} value={s}>{DELIVERY_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/30 py-20 text-muted-foreground">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">No hay entregas para mostrar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((inv) => {
                const isOpen = expanded.has(inv.id);
                const nextStatuses = DELIVERY_NEXT_STATUS[inv.deliveryStatus] ?? [];
                const busy = updatingId === inv.id;
                return (
                  <div key={inv.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">#{inv.id} · {inv.customerName}</span>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            {inv.fulfillmentType === "Delivery" ? "Delivery" : "Pickup"}
                          </Badge>
                          <StatusBadge status={inv.deliveryStatus} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{inv.customerPhone}</span>
                          {inv.deliveryAddress && (
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{inv.deliveryAddress}</span>
                          )}
                          <span>{new Date(inv.createdAt).toLocaleString("es-DO")}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{money(inv.total)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {inv.orders.length === 1 ? "1 orden por franquicia" : `${inv.orders.length} órdenes por franquicia`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {nextStatuses.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={s === "Cancelled" ? "outline" : "default"}
                            disabled={busy}
                            onClick={() => onAdvanceStatus?.(inv.id, s)}
                          >
                            {DELIVERY_STATUS_LABELS[s]}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => toggleExpand(inv.id)}
                                aria-label={isOpen ? "Colapsar" : "Expandir"}>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="space-y-3 border-t bg-muted/20 px-5 py-4">
                        {inv.orders.map((o) => (
                          <div key={o.orderId} className="rounded-xl border bg-card p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 text-primary" />
                                <span className="font-semibold">{o.restaurantName}</span>
                                <Badge variant="secondary" className="text-[10px]">{o.orderNumber}</Badge>
                                <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                              </div>
                              <span className="text-sm font-bold">{money(o.total)}</span>
                            </div>
                            <ul className="mt-2 space-y-1 text-sm">
                              {o.items.map((it) => (
                                <li key={it.dishId} className="flex justify-between text-muted-foreground">
                                  <span>{it.quantity}× {it.dishName}</span>
                                  <span>{money(it.subtotal)}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="mt-2 flex flex-wrap gap-x-4 border-t pt-2 text-[11px] text-muted-foreground">
                              <span>Subtotal {money(o.subtotal)}</span>
                              <span>ITBIS {money(o.tax)}</span>
                              <span>Propina {money(o.tip)}</span>
                            </div>
                          </div>
                        ))}

                        <div className="flex flex-wrap justify-end gap-x-6 px-1 text-xs text-muted-foreground">
                          <span>Subtotal {money(inv.subTotal)}</span>
                          <span>ITBIS {money(inv.taxITBIS)}</span>
                          <span>Propina legal {money(inv.legalTip)}</span>
                          <span className="font-bold text-foreground">Total {money(inv.total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
