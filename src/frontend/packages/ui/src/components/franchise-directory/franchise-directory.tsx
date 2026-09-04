"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, ChevronDown, Clock, MapPin, Minus, Package, Plus, Receipt, Search,
  ShoppingCart, SlidersHorizontal, Star, Store, User, X,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { MOCK_DIRECTORY_DISHES, MOCK_FOOD_CATEGORIES, MOCK_FRANCHISES } from "./mock-directory";
import type { CartLine, DirectoryDish, FranchiseCartGroup, FranchiseSummary } from "./types";

const TAX_RATE = 0.18;
const TIP_RATE = 0.10;

const money = (n: number) =>
  `RD$ ${Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

const BUSINESS_TILES = [
  { key: "restaurantes", name: "Restaurantes", emoji: "🍔", active: true },
  { key: "market",       name: "Market",       emoji: "🛒", active: false },
  { key: "mercados",     name: "Mercados",     emoji: "🥫", active: false },
  { key: "farmacias",    name: "Farmacias",    emoji: "💊", active: false },
  { key: "bebidas",      name: "Bebidas",      emoji: "🍷", active: false },
  { key: "tiendas",      name: "Tiendas",      emoji: "🛍️", active: false },
  { key: "mascotas",     name: "Mascotas",     emoji: "🐶", active: false },
];

type View =
  | { kind: "register" }
  | { kind: "home" }
  | { kind: "restaurants" }
  | { kind: "menu"; restaurantId: number }
  | { kind: "cart" };

export interface FranchiseDirectoryProps {

  initialView?: "register" | "home" | "restaurants" | "menu" | "cart";

  initialRestaurantId?: number;

  initialCart?: CartLine[];
  franchises?: FranchiseSummary[];
  dishes?: DirectoryDish[];
  className?: string;
}

export function FranchiseDirectory({
  initialView = "home",
  initialRestaurantId,
  initialCart = [],
  franchises = MOCK_FRANCHISES,
  dishes = MOCK_DIRECTORY_DISHES,
  className,
}: FranchiseDirectoryProps) {
  const [view, setView] = useState<View>(
    initialView === "menu"
      ? { kind: "menu", restaurantId: initialRestaurantId ?? franchises[0]?.restaurantId ?? 1 }
      : { kind: initialView },
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [search, setSearch] = useState("");
  const [dishSearch, setDishSearch] = useState("");
  const [foodFilter, setFoodFilter] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [menuChip, setMenuChip] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>(initialCart);

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const displayName = customerName.trim() || "Invitado";

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

  const openMenu = (restaurantId: number) => {
    setMenuChip(null);
    setDishSearch("");
    setView({ kind: "menu", restaurantId });
  };

  const qtyControls = (dishId: number, qty: number, small = false) => (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className={cn(small && "h-6 w-6 p-0")}
              onClick={() => changeQty(dishId, -1)} aria-label="Quitar uno">
        <Minus className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </Button>
      <span className={cn("text-center font-bold", small ? "w-4 text-sm" : "w-5 text-sm")}>{qty}</span>
      <Button size="sm" variant="outline" className={cn(small && "h-6 w-6 p-0")}
              onClick={() => changeQty(dishId, 1)} aria-label="Agregar uno">
        <Plus className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </Button>
    </div>
  );

  if (view.kind === "register") {
    return (
      <div className={cn("mx-auto max-w-md space-y-6 py-10", className)}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Crea tu cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registrate para explorar los restaurantes y pedir de varias franquicias con un solo pago
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
          <Button className="w-full"
                  disabled={!customerName.trim() || !customerPhone.trim()}
                  onClick={() => setView({ kind: "home" })}>
            Registrarme y explorar
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Prototipo: el registro real vive en la página de reservas
          </p>
        </div>
      </div>
    );
  }

  if (view.kind === "home") {
    return (
      <div className={cn("space-y-8", className)}>

        <div className="flex flex-wrap items-center gap-4 border-b pb-4">
          <div className="flex items-center gap-2 font-extrabold text-primary">
            <Store className="h-6 w-6" />
            <span className="text-lg tracking-tight">SmartMenu Delivery</span>
          </div>
          <button className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Enviar a</span>
            <b>Santo Domingo D.N.</b>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="rounded-full pl-9" placeholder="Buscar locales"
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   onFocus={() => setView({ kind: "restaurants" })} />
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            {cartCount > 0 && (
              <Button size="sm" variant="outline" className="relative ml-2" onClick={() => setView({ kind: "cart" })}>
                <ShoppingCart className="h-4 w-4" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {cartCount}
                </span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {BUSINESS_TILES.map((tile) => (
            <button
              key={tile.key}
              disabled={!tile.active}
              onClick={() => tile.active && setView({ kind: "restaurants" })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border bg-card px-3 py-5 shadow-sm transition",
                tile.active
                  ? "ring-1 ring-primary/30 hover:-translate-y-0.5 hover:shadow-md"
                  : "opacity-50",
              )}
            >
              <span className="text-4xl" aria-hidden>{tile.emoji}</span>
              <span className="text-xs font-semibold">{tile.name}</span>
              {!tile.active && <span className="text-[9px] text-muted-foreground">Próximamente</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {franchises.map((f) => (
            <button
              key={f.restaurantId}
              disabled={!f.isOpen}
              onClick={() => openMenu(f.restaurantId)}
              title={f.name}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border-2 bg-card text-3xl shadow-sm transition",
                f.isOpen ? "border-primary/20 hover:scale-105 hover:border-primary" : "opacity-40",
              )}
              aria-label={f.name}
            >
              <span aria-hidden>{f.emoji}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => setView({ kind: "restaurants" })}
                  className="rounded-2xl bg-amber-100 p-6 text-left transition hover:shadow-md dark:bg-amber-900/30">
            <h3 className="text-xl font-extrabold">Restaurantes</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pide de varias franquicias en un solo carrito
            </p>
          </button>
          <div className="rounded-2xl bg-rose-100 p-6 dark:bg-rose-900/30">
            <h3 className="text-xl font-extrabold">Un solo pago</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada restaurante recibe y procesa su propia orden
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold">Descubre estas opciones</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {dishes.filter((d) => d.bestSeller).slice(0, 4).map((d) => {
              const f = franchises.find((x) => x.restaurantId === d.restaurantId)!;
              return (
                <button key={d.dishId} onClick={() => openMenu(d.restaurantId)} disabled={!f.isOpen}
                        className={cn("overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition",
                                      f.isOpen ? "hover:-translate-y-0.5 hover:shadow-md" : "opacity-50")}>
                  <div className="flex h-24 items-center justify-center bg-muted/40 text-5xl" aria-hidden>
                    {f.emoji}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === "restaurants") {
    const q = search.trim().toLowerCase();
    const list = franchises.filter((f) => {
      const byText = !q || f.name.toLowerCase().includes(q) || f.cuisine.toLowerCase().includes(q);
      const byCat = !foodFilter || f.foodCategories.includes(foodFilter);
      return byText && byCat;
    });
    const carousel = MOCK_FOOD_CATEGORIES.slice(0, 10);
    return (
      <div className={cn("space-y-6", className)}>

        <div className="flex items-center justify-between gap-3">
          <Button size="sm" variant="ghost" aria-label="Volver" onClick={() => setView({ kind: "home" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <button className="flex items-center gap-1 text-sm font-semibold">
            Santo Domingo D.N. <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
            {cartCount > 0 && (
              <Button size="sm" variant="outline" className="relative" onClick={() => setView({ kind: "cart" })}>
                <ShoppingCart className="h-4 w-4" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {cartCount}
                </span>
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="rounded-full pl-9" placeholder="Buscar…" value={search}
                 onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowAllCategories(true)}>
          Filtros <SlidersHorizontal className="ml-2 h-3.5 w-3.5" />
        </Button>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Comidas</h2>
            <button className="text-sm font-semibold text-primary" onClick={() => setShowAllCategories(true)}>
              Ver todas
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {carousel.map((c) => (
              <button key={c.slug}
                      onClick={() => setFoodFilter(foodFilter === c.slug ? null : c.slug)}
                      className="flex w-20 flex-shrink-0 flex-col items-center gap-1.5">
                <span className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-xl border bg-card text-3xl shadow-sm transition",
                  foodFilter === c.slug && "border-primary ring-2 ring-primary/40",
                )} aria-hidden>{c.emoji}</span>
                <span className="text-center text-[11px] leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <h2 className="text-lg font-bold">
          {list.length} {list.length === 1 ? "restaurante" : "restaurantes"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((f) => (
            <button key={f.restaurantId} disabled={!f.isOpen} onClick={() => openMenu(f.restaurantId)}
                    className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition",
                                  f.isOpen ? "hover:-translate-y-0.5 hover:shadow-md" : "opacity-50")}>
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-muted/40 text-3xl" aria-hidden>
                {f.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Recibes en <b>{f.deliveryMin}-{f.deliveryMax} min</b>
                </p>
                {!f.isOpen && <Badge variant="secondary" className="mt-1 text-[10px]">Cerrado</Badge>}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{f.rating.toFixed(1)}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-muted-foreground">
              <Store className="h-8 w-8 opacity-30" />
              <p className="text-sm">Sin resultados</p>
            </div>
          )}
        </div>

        {showAllCategories && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10"
               onClick={() => setShowAllCategories(false)}>
            <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
                 onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <button aria-label="Cerrar" onClick={() => setShowAllCategories(false)}>
                  <X className="h-5 w-5" />
                </button>
                <h3 className="text-lg font-bold">Comidas</h3>
                <button className="text-sm font-semibold text-primary"
                        onClick={() => { setFoodFilter(null); setShowAllCategories(false); }}>
                  Restablecer
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
                {MOCK_FOOD_CATEGORIES.map((c) => (
                  <button key={c.slug}
                          onClick={() => { setFoodFilter(c.slug); setShowAllCategories(false); }}
                          className="flex flex-col items-center gap-1.5">
                    <span className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full border bg-card text-3xl shadow-sm",
                      foodFilter === c.slug && "border-primary ring-2 ring-primary/40",
                    )} aria-hidden>{c.emoji}</span>
                    <span className="text-center text-[11px] leading-tight">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view.kind === "menu") {
    const franchise = franchises.find((f) => f.restaurantId === view.restaurantId)!;
    const menu = dishes.filter((d) => d.restaurantId === view.restaurantId);
    const categories = [...new Set(menu.map((d) => d.category))];
    const dq = dishSearch.trim().toLowerCase();
    const visibleMenu = menu.filter((d) => {
      const byChip = !menuChip || d.category === menuChip;
      const byText = !dq || d.name.toLowerCase().includes(dq) || d.description.toLowerCase().includes(dq);
      return byChip && byText;
    });
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" aria-label="Volver" onClick={() => setView({ kind: "restaurants" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 font-extrabold text-primary">
            <Store className="h-5 w-5" /><span>SmartMenu Delivery</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex h-24 w-24 items-center justify-center rounded-2xl border bg-muted/40 text-5xl shadow-sm" aria-hidden>
            {franchise.emoji}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{franchise.name}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <b>{franchise.rating.toFixed(1)}</b>
              <span className="text-muted-foreground">{franchise.reviews} opiniones</span>
            </p>
            <Badge className="mt-2 uppercase">Entrega</Badge>
          </div>
        </div>

        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="rounded-full pl-9" placeholder="Buscar productos…" value={dishSearch}
                 onChange={(e) => setDishSearch(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={menuChip === null ? "default" : "outline"} className="rounded-full"
                  onClick={() => setMenuChip(null)}>
            Menú
          </Button>
          {categories.map((cat) => (
            <Button key={cat} size="sm" variant={menuChip === cat ? "default" : "outline"} className="rounded-full"
                    onClick={() => setMenuChip(menuChip === cat ? null : cat)}>
              {cat}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid content-start gap-3 sm:grid-cols-2">
            {visibleMenu.map((d) => {
              const qty = cart.find((l) => l.dish.dishId === d.dishId)?.quantity ?? 0;
              return (
                <div key={d.dishId} className="rounded-2xl border bg-card p-4 shadow-sm">
                  {d.bestSeller && (
                    <Badge className="mb-2 bg-amber-200 text-[10px] font-bold text-amber-900 hover:bg-amber-200">
                      Más vendido
                    </Badge>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{d.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
                      <p className="mt-2 font-bold">{money(d.price)}</p>
                    </div>
                    <span className="text-4xl" aria-hidden>{franchise.emoji}</span>
                  </div>
                  <div className="mt-3">
                    {qty === 0 ? (
                      <Button size="sm" className="w-full" onClick={() => addDish(d)}>
                        <Plus className="mr-1 h-4 w-4" />Agregar
                      </Button>
                    ) : qtyControls(d.dishId, qty)}
                  </div>
                </div>
              );
            })}
            {visibleMenu.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-muted-foreground">
                <Search className="h-8 w-8 opacity-30" />
                <p className="text-sm">Sin productos para esa búsqueda</p>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="font-bold">Mi pedido</h3>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Package className="h-10 w-10 opacity-30" />
                <p className="text-sm">Tu pedido está vacío</p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {groups.map((g) => (
                  <div key={g.franchise.restaurantId} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <span aria-hidden>{g.franchise.emoji}</span>{g.franchise.name}
                      </span>
                      <Badge variant="outline" className="font-mono text-[9px]">
                        RestaurantId={g.franchise.restaurantId}
                      </Badge>
                    </div>
                    {g.lines.map((l) => (
                      <div key={l.dish.dishId} className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{l.quantity}× {l.dish.name}</span>
                        <span className="font-medium">{money(l.dish.price * l.quantity)}</span>
                      </div>
                    ))}
                    <p className="mt-1.5 border-t pt-1.5 text-right text-[11px] font-semibold">
                      Orden: {money(g.total)}
                    </p>
                  </div>
                ))}
                <Button className="w-full" onClick={() => setView({ kind: "cart" })}>
                  Ver pedido · {money(invoiceTotal)}
                </Button>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" aria-label="Volver" onClick={() => setView({ kind: "restaurants" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tu pedido</h1>
          <p className="text-xs text-muted-foreground">
            {displayName !== "Invitado" ? `Hola, ${displayName} · ` : ""}Un solo pago, una orden por franquicia
          </p>
        </div>
      </div>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-20 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 opacity-30" />
          <p className="text-sm">Tu carrito está vacío</p>
          <Button variant="outline" onClick={() => setView({ kind: "restaurants" })}>
            Explorar restaurantes
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

                  <Badge variant="outline" className="font-mono text-[10px]">
                    Orders.RestaurantId = {g.franchise.restaurantId}
                  </Badge>
                </div>
                <div className="space-y-2 px-5 py-4">
                  {g.lines.map((l) => (
                    <div key={l.dish.dishId} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        {qtyControls(l.dish.dishId, l.quantity, true)}
                        <span className="ml-1">{l.dish.name}</span>
                      </div>
                      <span className="font-medium">{money(l.dish.price * l.quantity)}</span>
                    </div>
                  ))}

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
