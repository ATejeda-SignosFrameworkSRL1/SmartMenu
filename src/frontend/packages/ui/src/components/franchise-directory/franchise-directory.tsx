"use client";

// FRANCHISE-DIRECTORY (PROTOTIPO) — maquetacion navegable del marketplace del cliente:
// Registro (en la pagina de reservation) → Directorio de franquicias → Menu de una
// franquicia → Carrito MIXTO agrupado por franquicia. El carrito hace VISIBLE la regla
// del modelo de datos: cada grupo es una futura Order independiente con su
// RestaurantId (FK) y su verdad fiscal propia; la factura global solo suma y cobra.
// PRESENTACIONAL: estado local + mocks; sin APIs ni BD.

import { useMemo, useState } from "react";
import {
  ArrowLeft, Clock, Minus, Plus, Receipt, Search, ShoppingCart, Star, Store, User, UtensilsCrossed,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { MOCK_DIRECTORY_DISHES, MOCK_FRANCHISES } from "./mock-directory";
import type { CartLine, DirectoryDish, FranchiseCartGroup, FranchiseSummary } from "./types";

// En la implementacion real estas tasas vienen de BillingSettings (nunca hardcodeadas);
// aqui solo pintan la maquetacion.
const TAX_RATE = 0.18;
const TIP_RATE = 0.10;

const money = (n: number) =>
  `RD$ ${Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

type View =
  | { kind: "register" }
  | { kind: "directory" }
  | { kind: "menu"; restaurantId: number }
  | { kind: "cart" };

export interface FranchiseDirectoryProps {
  /** Vista inicial de la story ('register' muestra el alta previa del cliente). */
  initialView?: "register" | "directory" | "cart";
  /** Carrito precargado (para la story del split multi-franquicia). */
  initialCart?: CartLine[];
  franchises?: FranchiseSummary[];
  dishes?: DirectoryDish[];
  className?: string;
}

export function FranchiseDirectory({
  initialView = "directory",
  initialCart = [],
  franchises = MOCK_FRANCHISES,
  dishes = MOCK_DIRECTORY_DISHES,
  className,
}: FranchiseDirectoryProps) {
  const [view, setView] = useState<View>({ kind: initialView });
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [registered, setRegistered] = useState(initialView !== "register");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>(initialCart);

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  // ── Carrito agrupado por franquicia = las futuras Orders independientes ──
  const groups: FranchiseCartGroup[] = useMemo(() => {
    const byRestaurant = new Map<number, CartLine[]>();
    for (const line of cart) {
      const list = byRestaurant.get(line.dish.restaurantId) ?? [];
      list.push(line);
      byRestaurant.set(line.dish.restaurantId, list);
    }
    return [...byRestaurant.entries()].map(([restaurantId, lines]) => {
      const franchise = franchises.find((f) => f.restaurantId === restaurantId)!;
      const subtotal = lines.reduce((s, l) => s + l.dish.price * l.quantity, 0);
      const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
      const tip = Math.round(subtotal * TIP_RATE * 100) / 100;
      return { franchise, lines, subtotal, tax, tip, total: subtotal + tax + tip };
    });
  }, [cart, franchises]);

  const invoiceTotal = groups.reduce((s, g) => s + g.total, 0);

  const addDish = (dish: DirectoryDish) =>
    setCart((prev) => {
      const i = prev.findIndex((l) => l.dish.dishId === dish.dishId);
      if (i < 0) return [...prev, { dish, quantity: 1 }];
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + 1 };
      return next;
    });

  const changeQty = (dishId: number, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.dish.dishId === dishId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );

  const visibleFranchises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return franchises;
    return franchises.filter(
      (f) => f.name.toLowerCase().includes(q) || f.cuisine.toLowerCase().includes(q),
    );
  }, [franchises, search]);

  // ── Header comun ──
  const Header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {view.kind !== "directory" && registered && (
          <Button size="sm" variant="ghost" aria-label="Volver"
                  onClick={() => setView({ kind: "directory" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {view.kind === "cart" ? "Tu pedido" : "Directorio de franquicias"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {registered && customerName ? `Hola, ${customerName} · ` : ""}
            Pide de varios restaurantes en una sola factura
          </p>
        </div>
      </div>
      {registered && view.kind !== "cart" && (
        <Button variant="outline" onClick={() => setView({ kind: "cart" })} className="relative">
          <ShoppingCart className="mr-2 h-4 w-4" />
          Carrito
          {cartCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {cartCount}
            </span>
          )}
        </Button>
      )}
    </div>
  );

  // ── Vista: registro previo (pagina de reservation) ──
  if (view.kind === "register") {
    return (
      <div className={cn("mx-auto max-w-md space-y-6 py-10", className)}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Crea tu cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registrate para navegar el directorio y pedir de varias franquicias con un solo pago
          </p>
        </div>
        <div className="space-y-3 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fd-name">Nombre</label>
            <Input id="fd-name" placeholder="Tu nombre" value={customerName}
                   onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fd-phone">Teléfono</label>
            <Input id="fd-phone" placeholder="809-555-0000" value={customerPhone}
                   onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!customerName.trim() || !customerPhone.trim()}
            onClick={() => { setRegistered(true); setView({ kind: "directory" }); }}
          >
            Registrarme y explorar
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Prototipo: el registro real vive en la página de reservas
          </p>
        </div>
      </div>
    );
  }

  // ── Vista: directorio ──
  if (view.kind === "directory") {
    return (
      <div className={cn("space-y-6", className)}>
        {Header}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar franquicia o cocina…"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFranchises.map((f) => (
            <button
              key={f.restaurantId}
              disabled={!f.isOpen}
              onClick={() => setView({ kind: "menu", restaurantId: f.restaurantId })}
              className={cn(
                "group rounded-2xl border bg-card p-5 text-left shadow-sm transition",
                f.isOpen ? "hover:-translate-y-0.5 hover:shadow-md" : "opacity-60",
              )}
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl" aria-hidden>{f.emoji}</span>
                <Badge variant={f.isOpen ? "default" : "secondary"} className="text-[10px] uppercase">
                  {f.isOpen ? "Abierto" : "Cerrado"}
                </Badge>
              </div>
              <h3 className="mt-3 font-semibold">{f.name}</h3>
              <p className="text-xs text-muted-foreground">{f.tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{f.cuisine}</Badge>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{f.rating.toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />{f.prepMinutes} min
                </span>
              </div>
            </button>
          ))}
          {visibleFranchises.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-muted-foreground">
              <Store className="h-8 w-8 opacity-30" />
              <p className="text-sm">Sin resultados para “{search}”</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Vista: menu de una franquicia ──
  if (view.kind === "menu") {
    const franchise = franchises.find((f) => f.restaurantId === view.restaurantId)!;
    const menu = dishes.filter((d) => d.restaurantId === view.restaurantId);
    const categories = [...new Set(menu.map((d) => d.category))];
    return (
      <div className={cn("space-y-6", className)}>
        {Header}
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <span className="text-3xl" aria-hidden>{franchise.emoji}</span>
          <div>
            <h2 className="font-semibold">{franchise.name}</h2>
            <p className="text-xs text-muted-foreground">
              {franchise.cuisine} · <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" /> {franchise.rating.toFixed(1)} · {franchise.prepMinutes} min
            </p>
          </div>
        </div>
        {categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5" />{cat}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {menu.filter((d) => d.category === cat).map((d) => {
                const inCart = cart.find((l) => l.dish.dishId === d.dishId)?.quantity ?? 0;
                return (
                  <div key={d.dishId} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.description}</p>
                      <p className="mt-1 text-sm font-bold">{money(d.price)}</p>
                    </div>
                    {inCart === 0 ? (
                      <Button size="sm" onClick={() => addDish(d)} aria-label={`Agregar ${d.name}`}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => changeQty(d.dishId, -1)} aria-label="Quitar uno">
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-5 text-center text-sm font-bold">{inCart}</span>
                        <Button size="sm" variant="outline" onClick={() => changeQty(d.dishId, 1)} aria-label="Agregar uno">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Vista: carrito mixto agrupado por franquicia ──
  return (
    <div className={cn("space-y-6", className)}>
      {Header}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-20 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 opacity-30" />
          <p className="text-sm">Tu carrito está vacío</p>
          <Button variant="outline" onClick={() => setView({ kind: "directory" })}>
            Explorar franquicias
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Pagas <b>una sola factura</b>; cada franquicia recibe y cocina <b>su propia orden</b>:
          </p>
          <div className="space-y-4">
            {groups.map((g, idx) => (
              <div key={g.franchise.restaurantId} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>{g.franchise.emoji}</span>
                    <span className="font-semibold">{g.franchise.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      Orden {idx + 1} de {groups.length}
                    </Badge>
                  </div>
                  {/* La FK que exige el modelo: cada Order pertenece a UN Restaurant */}
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Orders.RestaurantId = {g.franchise.restaurantId}
                  </Badge>
                </div>
                <div className="space-y-2 px-5 py-4">
                  {g.lines.map((l) => (
                    <div key={l.dish.dishId} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0"
                                onClick={() => changeQty(l.dish.dishId, -1)} aria-label="Quitar uno">
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-4 text-center font-bold">{l.quantity}</span>
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0"
                                onClick={() => changeQty(l.dish.dishId, 1)} aria-label="Agregar uno">
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="ml-1">{l.dish.name}</span>
                      </div>
                      <span className="font-medium">{money(l.dish.price * l.quantity)}</span>
                    </div>
                  ))}
                  {/* Verdad fiscal POR franquicia (RNC propio): ITBIS/propina por orden */}
                  <div className="mt-2 flex flex-wrap justify-end gap-x-4 border-t pt-2 text-[11px] text-muted-foreground">
                    <span>Subtotal {money(g.subtotal)}</span>
                    <span>ITBIS 18% {money(g.tax)}</span>
                    <span>Propina 10% {money(g.tip)}</span>
                    <span className="font-bold text-foreground">Orden: {money(g.total)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Factura global = suma de las ordenes (envoltorio de cobro) */}
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Factura global</p>
                  <p className="text-xs text-muted-foreground">
                    {groups.length === 1 ? "1 orden" : `${groups.length} órdenes`} · un solo pago
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">{money(invoiceTotal)}</span>
                <Button size="lg">Pagar todo</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
