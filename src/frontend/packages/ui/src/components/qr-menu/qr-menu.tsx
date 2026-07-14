"use client";

// QR-MENU (PROTOTIPO) — recreacion del menu digital que ve el cliente al escanear
// el QR de su mesa (client-app), con la senal "PARA LLEVAR" por plato.
// DOS variantes de UX conviven (prop takeawayUx) para comparar en Storybook:
//
//  'inline' (recomendada — "senal silenciosa"): se marca MIENTRAS navega.
//     - Card: "Agregar" (1 tap = mesa) + boton compacto 🥡 (= para llevar).
//     - Modal del plato: switch "🥡 Para llevar" junto a la cantidad.
//     - Carrito: badge 🍽️/🥡 alternable por linea + switch "¿Todo para llevar?".
//
//  'review' (seleccion al final): arma el pedido normal y AL FINAL, junto a
//     "Confirmar Pedido", un boton "🥡 Para llevar" abre una PANTALLA DE SELECCION
//     que lista los platos pedidos con un switch por cada uno. No hay marcado
//     durante la navegacion (card y modal sin senal).
//
// PRESENTACIONAL: estado local + mocks; sin APIs ni BD.
// Mapeo futuro: OrderItem.IsTakeaway (por item; distinto de Order.IsPickup por orden).

import { useMemo, useState } from "react";
import {
  ArrowLeft, Check, Clock, Globe, Minus, Plus, Search, ShoppingCart, X,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { Switch } from "../switch";
import { MOCK_QR_MENU } from "./mock-menu";
import {
  MENU_CATEGORIES, MENU_TAG_META,
  type CourseTiming, type MenuCategory, type MenuTag, type QrMenuCartLine, type QrMenuDish,
} from "./types";

// En la implementacion real las tasas vienen de BillingSettings (nunca hardcodeadas).
const TAX_RATE = 0.18;
const TIP_RATE = 0.10;

const money = (n: number) =>
  `RD$ ${Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

const COURSE_CHIPS: { key: CourseTiming; label: string; sub: string; emoji: string }[] = [
  { key: "Entrada",     label: "Entrada",      sub: "Sirve primero",   emoji: "🥗" },
  { key: "PlatoFuerte", label: "Plato Fuerte", sub: "Plato principal", emoji: "🍖" },
  { key: "Postre",      label: "Postre",       sub: "Al final",        emoji: "🍰" },
];

interface DishModalState {
  dish: QrMenuDish;
  quantity: number;
  takeaway: boolean;
  courseTiming: CourseTiming;
  garnish: string;
  customizations: string;
  allergies: string;
  notes: string;
}

export interface QrMenuProps {
  /** UX del "para llevar": 'inline' (marcar al navegar) | 'review' (seleccion al final). */
  takeawayUx?: "inline" | "review";
  initialCart?: QrMenuCartLine[];
  initialCartOpen?: boolean;
  /** Abre directamente la pantalla de seleccion (solo variante 'review'). */
  initialSelectOpen?: boolean;
  dishes?: QrMenuDish[];
  className?: string;
}

export function QrMenu({
  takeawayUx = "inline",
  initialCart = [],
  initialCartOpen = false,
  initialSelectOpen = false,
  dishes = MOCK_QR_MENU,
  className,
}: QrMenuProps) {
  const isReview = takeawayUx === "review";
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<MenuTag>>(new Set());
  const [activeCategory, setActiveCategory] = useState<"Todos" | MenuCategory>("Todos");
  const [cart, setCart] = useState<QrMenuCartLine[]>(initialCart);
  const [cartOpen, setCartOpen] = useState(initialCartOpen || initialSelectOpen);
  const [selectOpen, setSelectOpen] = useState(initialSelectOpen && isReview);
  const [modal, setModal] = useState<DishModalState | null>(null);

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.dish.price * l.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const tip = Math.round(subtotal * TIP_RATE * 100) / 100;
  const total = subtotal + tax + tip;
  const allTakeaway = cart.length > 0 && cart.every((l) => l.takeaway);
  const takeawayCount = cart.filter((l) => l.takeaway).reduce((s, l) => s + l.quantity, 0);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dishes.filter((d) => {
      const byText = !q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
      const byTags = activeTags.size === 0 || [...activeTags].every((t) => d.tags.includes(t));
      const byCat = activeCategory === "Todos" || d.category === activeCategory;
      return byText && byTags && byCat;
    });
  }, [dishes, search, activeTags, activeCategory]);

  const toggleTag = (t: MenuTag) =>
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });

  /** Inserta la linea; fusiona solo lineas "simples" iguales (mismo plato y misma senal). */
  const pushLine = (line: QrMenuCartLine) =>
    setCart((prev) => {
      const simple = !line.customizations && !line.allergies && !line.notes && !line.garnish;
      if (simple) {
        const i = prev.findIndex(
          (l) => l.dish.dishId === line.dish.dishId && l.takeaway === line.takeaway
              && !l.customizations && !l.allergies && !l.notes && !l.garnish,
        );
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], quantity: next[i].quantity + line.quantity };
          return next;
        }
      }
      return [...prev, line];
    });

  const quickAdd = (dish: QrMenuDish, takeaway: boolean) =>
    pushLine({ dish, quantity: 1, takeaway });

  const addFromModal = (m: DishModalState) => {
    pushLine({
      dish: m.dish, quantity: m.quantity, takeaway: m.takeaway, courseTiming: m.courseTiming,
      garnish: m.garnish || undefined, customizations: m.customizations || undefined,
      allergies: m.allergies || undefined, notes: m.notes || undefined,
    });
    setModal(null);
  };

  const changeQty = (index: number, delta: number) =>
    setCart((prev) =>
      prev
        .map((l, i) => (i === index ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );

  const toggleLineTakeaway = (index: number) =>
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, takeaway: !l.takeaway } : l)));

  const setAllTakeaway = (value: boolean) =>
    setCart((prev) => prev.map((l) => ({ ...l, takeaway: value })));

  const openModal = (dish: QrMenuDish) =>
    setModal({
      dish, quantity: 1, takeaway: false,
      courseTiming: dish.category === "Entradas" ? "Entrada" : dish.category === "Postres" ? "Postre" : "PlatoFuerte",
      garnish: "", customizations: "", allergies: "", notes: "",
    });

  const takeawayBadge = (takeaway: boolean) => (
    <Badge variant={takeaway ? "default" : "secondary"} className="text-[10px]">
      {takeaway ? "🥡 PARA LLEVAR" : "🍽️ En mesa"}
    </Badge>
  );

  const categories: ("Todos" | MenuCategory)[] = ["Todos", ...MENU_CATEGORIES.map((c) => c.key)];

  return (
    <div className={cn("space-y-5", className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">SmartMenu</h1>
          <p className="text-xs text-muted-foreground">Menú Digital · Mesa 7</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" /> Español
          </span>
          <Button variant="default" className="relative rounded-full" size="sm"
                  onClick={() => setCartOpen(true)} aria-label="Ver carrito">
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── Buscador + filtros por etiqueta ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="rounded-xl pl-9" placeholder="Buscar platos…" value={search}
               onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MENU_TAG_META) as MenuTag[]).map((t) => (
          <button key={t} onClick={() => toggleTag(t)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    activeTags.has(t) ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted/50",
                  )}>
            {MENU_TAG_META[t].emoji} {MENU_TAG_META[t].label}
          </button>
        ))}
      </div>

      {/* ── Tabs de categoria ── */}
      <div className="flex flex-wrap gap-2 border-y py-3">
        {categories.map((c) => (
          <Button key={c} size="sm" variant={activeCategory === c ? "default" : "outline"}
                  className="rounded-full" onClick={() => setActiveCategory(c)}>
            {c}
          </Button>
        ))}
      </div>

      {/* ── Secciones por categoria ── */}
      {MENU_CATEGORIES.filter((c) => activeCategory === "Todos" || c.key === activeCategory).map((c) => {
        const sectionDishes = visible.filter((d) => d.category === c.key);
        if (sectionDishes.length === 0) return null;
        return (
          <section key={c.key} className="space-y-3">
            <div>
              <h2 className="text-xl font-bold">{c.key}</h2>
              <p className="text-sm text-muted-foreground">{c.subtitle}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sectionDishes.map((d) => (
                <div key={d.dishId} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <button className="flex h-32 w-full items-center justify-center bg-muted/40 text-6xl transition hover:bg-muted/60"
                          onClick={() => openModal(d)} aria-label={`Ver ${d.name}`}>
                    <span aria-hidden>{d.emoji}</span>
                  </button>
                  <div className="space-y-2 p-4">
                    <div className="flex flex-wrap gap-1">
                      {d.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {MENU_TAG_META[t].emoji} {MENU_TAG_META[t].label}
                        </Badge>
                      ))}
                    </div>
                    <button className="text-left" onClick={() => openModal(d)}>
                      <p className="font-semibold">{d.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
                    </button>
                    <div className="flex items-end justify-between gap-2 pt-1">
                      <div>
                        <p className="text-lg font-extrabold text-primary">{money(d.price)}</p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />{d.prepMinutes} min
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="rounded-full" onClick={() => quickAdd(d, false)}>
                          Agregar
                        </Button>
                        {/* Boton 🥡 solo en la variante 'inline' (marcar al navegar). */}
                        {!isReview && (
                          <Button size="sm" variant="outline" className="rounded-full px-2.5"
                                  title="Agregar para llevar" aria-label={`Agregar ${d.name} para llevar`}
                                  onClick={() => quickAdd(d, true)}>
                            🥡
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-muted-foreground">
          <Search className="h-8 w-8 opacity-30" />
          <p className="text-sm">Sin platos para esos filtros</p>
        </div>
      )}

      {/* ── Modal de personalizacion del plato ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8"
             onClick={() => setModal(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex h-40 items-center justify-center bg-muted/40 text-7xl" aria-hidden>
              {modal.dish.emoji}
            </div>
            <div className="space-y-4 p-6">
              <div>
                <h3 className="text-2xl font-bold">{modal.dish.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {modal.dish.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {MENU_TAG_META[t].emoji} {MENU_TAG_META[t].label}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{modal.dish.description}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />{modal.dish.prepMinutes} minutos
                </p>
                <p className="mt-2 text-2xl font-extrabold text-primary">{money(modal.dish.price)}</p>
              </div>

              {/* Cantidad + (solo inline) switch PARA LLEVAR */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Cantidad</p>
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" className="rounded-full"
                            onClick={() => setModal({ ...modal, quantity: Math.max(1, modal.quantity - 1) })}
                            aria-label="Menos">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center text-lg font-bold">{modal.quantity}</span>
                    <Button size="sm" variant="outline" className="rounded-full"
                            onClick={() => setModal({ ...modal, quantity: modal.quantity + 1 })}
                            aria-label="Más">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {!isReview && (
                  <div className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 transition",
                    modal.takeaway && "border-primary bg-primary/5",
                  )}>
                    <div>
                      <p className="text-sm font-semibold">🥡 Para llevar</p>
                      <p className="text-[11px] text-muted-foreground">
                        {modal.takeaway ? "Te lo empacamos" : "Se sirve en la mesa"}
                      </p>
                    </div>
                    <Switch checked={modal.takeaway} aria-label="Para llevar"
                            onCheckedChange={(v) => setModal({ ...modal, takeaway: v })} />
                  </div>
                )}
              </div>

              {/* Momento de servicio */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">¿Cuándo lo quieres servir?</p>
                <div className="grid grid-cols-3 gap-2">
                  {COURSE_CHIPS.map((cc) => (
                    <button key={cc.key}
                            onClick={() => setModal({ ...modal, courseTiming: cc.key })}
                            className={cn(
                              "rounded-xl border p-3 text-center transition",
                              modal.courseTiming === cc.key
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card hover:bg-muted/50",
                            )}>
                      <span className="text-lg" aria-hidden>{cc.emoji}</span>
                      <p className="text-xs font-bold">{cc.label}</p>
                      <p className={cn("text-[10px]",
                        modal.courseTiming === cc.key ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {cc.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Guarnicion */}
              {modal.dish.garnishes && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="qr-garnish">Guarnición</label>
                  <select id="qr-garnish" value={modal.garnish}
                          onChange={(e) => setModal({ ...modal, garnish: e.target.value })}
                          className="w-full rounded-xl border bg-card px-3 py-2 text-sm">
                    {modal.dish.garnishes.map((g) => (
                      <option key={g} value={g === "Sin preferencia" ? "" : g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Personalizaciones / Alergias / Notas */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="qr-custom">Personalizaciones (opcional)</label>
                <Input id="qr-custom" placeholder="Ej: sin cebolla, extra queso" value={modal.customizations}
                       onChange={(e) => setModal({ ...modal, customizations: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="qr-allergy">¿Alergias? (importante)</label>
                <Input id="qr-allergy" placeholder="Ej: alérgico a mariscos, nueces" value={modal.allergies}
                       className="border-amber-300 focus-visible:ring-amber-400"
                       onChange={(e) => setModal({ ...modal, allergies: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="qr-notes">Notas adicionales (opcional)</label>
                <textarea id="qr-notes" rows={3} placeholder="Ej: Sin sal, extra salsa, término medio…"
                          value={modal.notes}
                          onChange={(e) => setModal({ ...modal, notes: e.target.value })}
                          className="w-full resize-none rounded-xl border bg-card px-3 py-2 text-sm" />
              </div>

              {/* Footer */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => addFromModal(modal)}>
                  {!isReview && modal.takeaway ? "🥡 " : ""}Agregar {money(modal.dish.price * modal.quantity)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Carrito (drawer) ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setCartOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-bold">Tu pedido · Mesa 7</h3>
              <button onClick={() => setCartOpen(false)} aria-label="Cerrar carrito"><X className="h-5 w-5" /></button>
            </div>

            {/* Variante inline: "¿Todo para llevar?" arriba (marcado durante navegacion). */}
            {!isReview && cart.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold">🥡 ¿Todo para llevar?</p>
                  <p className="text-[11px] text-muted-foreground">
                    {takeawayCount > 0
                      ? `${takeawayCount} de ${cartCount} platos se empacan`
                      : "Todo se sirve en la mesa"}
                  </p>
                </div>
                <Switch checked={allTakeaway} aria-label="Todo para llevar"
                        onCheckedChange={setAllTakeaway} />
              </div>
            )}

            {/* Variante review: aviso de cuantos van para llevar (se decide en la pantalla). */}
            {isReview && cart.length > 0 && takeawayCount > 0 && (
              <div className="border-b bg-primary/5 px-5 py-2.5 text-[11px] text-primary">
                🥡 {takeawayCount} de {cartCount} platos marcados para llevar
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {cart.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Tu carrito está vacío</p>
                </div>
              )}
              {cart.map((l, i) => (
                <div key={i} className={cn("rounded-xl border p-3", l.takeaway && "border-primary/40 bg-primary/5")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{l.dish.name}</p>
                      {(l.customizations || l.allergies || l.notes || l.garnish) && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {[l.garnish, l.customizations, l.allergies && `⚠️ ${l.allergies}`, l.notes]
                            .filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-bold">{money(l.dish.price * l.quantity)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-6 w-6 rounded-full p-0"
                              onClick={() => changeQty(i, -1)} aria-label="Quitar uno">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-4 text-center text-sm font-bold">{l.quantity}</span>
                      <Button size="sm" variant="outline" className="h-6 w-6 rounded-full p-0"
                              onClick={() => changeQty(i, 1)} aria-label="Agregar uno">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* inline: badge clicable (red de seguridad). review: badge de solo lectura
                        (la seleccion se hace en la pantalla dedicada). */}
                    {isReview ? (
                      takeawayBadge(l.takeaway)
                    ) : (
                      <button onClick={() => toggleLineTakeaway(i)} title="Cambiar entre mesa y para llevar">
                        {takeawayBadge(l.takeaway)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="space-y-2 border-t px-5 py-4">
                {takeawayCount > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    🥡 Los platos marcados “PARA LLEVAR” llegan empacados — la etiqueta viaja a cocina en la comanda.
                  </p>
                )}
                <div className="flex justify-between text-sm"><span>Subtotal</span><b>{money(subtotal)}</b></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>ITBIS 18%</span><span>{money(tax)}</span></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>Propina legal 10%</span><span>{money(tip)}</span></div>
                <div className="flex justify-between text-base font-extrabold"><span>Total</span><span>{money(total)}</span></div>
                {/* Variante review: boton "Para llevar" AL LADO de Confirmar → pantalla de seleccion. */}
                {isReview ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="lg" onClick={() => setSelectOpen(true)}>
                      🥡 Para llevar
                    </Button>
                    <Button size="lg">Confirmar pedido</Button>
                  </div>
                ) : (
                  <Button className="w-full" size="lg">Confirmar pedido</Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pantalla de SELECCION "Para llevar" (solo variante review) ── */}
      {isReview && selectOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/50" onClick={() => setSelectOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <button onClick={() => setSelectOpen(false)} aria-label="Volver al pedido"><ArrowLeft className="h-5 w-5" /></button>
              <div>
                <h3 className="text-lg font-bold">¿Cuáles para llevar?</h3>
                <p className="text-[11px] text-muted-foreground">
                  Marca los platos que quieres empacados; el resto se sirve en la mesa.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-5 py-2.5">
              <span className="text-xs text-muted-foreground">
                {takeawayCount} de {cartCount} marcados
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={() => setAllTakeaway(true)}>
                  Todos
                </Button>
                <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={() => setAllTakeaway(false)}>
                  Ninguno
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {cart.map((l, i) => (
                <button key={i} onClick={() => toggleLineTakeaway(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                          l.takeaway ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                        )}>
                  <span className={cn(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition",
                    l.takeaway ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                  )} aria-hidden>
                    {l.takeaway && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-2xl" aria-hidden>{l.dish.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{l.quantity}× {l.dish.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {l.takeaway ? "🥡 Para llevar" : "🍽️ En mesa"}
                    </span>
                  </span>
                  <span className="text-sm font-bold">{money(l.dish.price * l.quantity)}</span>
                </button>
              ))}
            </div>
            <div className="border-t px-5 py-4">
              <Button className="w-full" size="lg" onClick={() => setSelectOpen(false)}>
                Listo{takeawayCount > 0 ? ` · ${takeawayCount} para llevar` : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
