"use client";

// QR-MENU (PROTOTIPO) — menu digital del cliente al escanear el QR de su mesa.
// Senal "PARA LLEVAR" como PROCESO APARTE (no marcado por plato):
//   - Se arma el pedido de MESA normal y en el carrito, junto a "Confirmar Orden",
//     hay un boton "🥡 Para llevar".
//   - Ese boton NO abre una lista de seleccion: cambia el menu a MODO PARA LLEVAR y
//     el cliente vuelve al CATALOGO GENERAL a armar un pedido para llevar SEPARADO.
//   - Dos procesos independientes, un pedido cada uno: el de mesa y el para llevar,
//     cada cual con su propia confirmacion.
// PRESENTACIONAL: estado local + mocks; sin APIs ni BD.
// Mapeo futuro: cada proceso = una Order (Order.IsPickup=true para la de llevar);
// no hace falta flag por item.

import { useMemo, useState } from "react";
import {
  ArrowLeft, Clock, Globe, Minus, Plus, Search, ShoppingCart, UtensilsCrossed, X,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
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

type OrderMode = "dinein" | "takeaway";

interface DishModalState {
  dish: QrMenuDish;
  quantity: number;
  courseTiming: CourseTiming;
  garnish: string;
  customizations: string;
  allergies: string;
  notes: string;
}

export interface QrMenuProps {
  /** Modo inicial: 'dinein' (pedido de mesa) | 'takeaway' (proceso para llevar). */
  initialMode?: OrderMode;
  /** Pedido de mesa precargado. */
  initialCart?: QrMenuCartLine[];
  /** Pedido para llevar precargado. */
  initialTakeawayCart?: QrMenuCartLine[];
  initialCartOpen?: boolean;
  dishes?: QrMenuDish[];
  className?: string;
}

export function QrMenu({
  initialMode = "dinein",
  initialCart = [],
  initialTakeawayCart = [],
  initialCartOpen = false,
  dishes = MOCK_QR_MENU,
  className,
}: QrMenuProps) {
  const [mode, setMode] = useState<OrderMode>(initialMode);
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<MenuTag>>(new Set());
  const [activeCategory, setActiveCategory] = useState<"Todos" | MenuCategory>("Todos");
  const [dineInCart, setDineInCart] = useState<QrMenuCartLine[]>(initialCart);
  const [takeawayCart, setTakeawayCart] = useState<QrMenuCartLine[]>(initialTakeawayCart);
  const [cartOpen, setCartOpen] = useState(initialCartOpen);
  const [modal, setModal] = useState<DishModalState | null>(null);
  // Modal "¿Estás seguro?" antes de confirmar (guarda qué proceso se confirma).
  const [confirmMode, setConfirmMode] = useState<OrderMode | null>(null);
  // Resultado: la comanda "impresa" dividida por estación (Cocina/Bar), como el ruteo real.
  const [comanda, setComanda] = useState<{ mode: OrderMode; cocina: number; bar: number } | null>(null);

  const isTakeaway = mode === "takeaway";
  const cart = isTakeaway ? takeawayCart : dineInCart;
  const setCart = isTakeaway ? setTakeawayCart : setDineInCart;

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.dish.price * l.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const tip = Math.round(subtotal * TIP_RATE * 100) / 100;
  const total = subtotal + tax + tip;

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

  /** Inserta la linea en el carrito ACTIVO (mesa o llevar segun el modo). */
  const pushLine = (line: QrMenuCartLine) =>
    setCart((prev) => {
      const simple = !line.customizations && !line.allergies && !line.notes && !line.garnish;
      if (simple) {
        const i = prev.findIndex(
          (l) => l.dish.dishId === line.dish.dishId
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

  const quickAdd = (dish: QrMenuDish) =>
    pushLine({ dish, quantity: 1, takeaway: isTakeaway });

  const addFromModal = (m: DishModalState) => {
    pushLine({
      dish: m.dish, quantity: m.quantity, takeaway: isTakeaway, courseTiming: m.courseTiming,
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

  const openModal = (dish: QrMenuDish) =>
    setModal({
      dish, quantity: 1,
      courseTiming: dish.category === "Entradas" ? "Entrada" : dish.category === "Postres" ? "Postre" : "PlatoFuerte",
      garnish: "", customizations: "", allergies: "", notes: "",
    });

  /** El boton estrella: inicia el PROCESO para llevar → vuelve al catalogo en modo llevar. */
  const startTakeaway = () => {
    setMode("takeaway");
    setCartOpen(false);
    setComanda(null);
  };

  // División Cocina/Bar de un carrito (prototipo: por categoría; el backend usa Zone.Type).
  const splitStations = (lines: QrMenuCartLine[]) => {
    const bar = lines.filter((l) => l.dish.category === "Bebidas").reduce((s, l) => s + l.quantity, 0);
    const cocina = lines.reduce((s, l) => s + l.quantity, 0) - bar;
    return { cocina, bar };
  };

  const backToDineIn = () => {
    setMode("dinein");
    setCartOpen(false);
  };

  // "Confirmar" ya no confirma directo: abre el modal "¿Estás seguro?".
  const confirmOrder = () => setConfirmMode(mode);

  // Al dar "Sí": se "imprime" la comanda a Cocina y al Bar (dividida por estación).
  const doConfirm = () => {
    if (!confirmMode) return;
    const targetCart = confirmMode === "takeaway" ? takeawayCart : dineInCart;
    setComanda({ mode: confirmMode, ...splitStations(targetCart) });
    if (confirmMode === "takeaway") { setTakeawayCart([]); setMode("dinein"); }
    else setDineInCart([]);
    setConfirmMode(null);
    setCartOpen(false);
  };

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
                  onClick={() => setCartOpen(true)} aria-label="Ver pedido">
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── Banner de MODO PARA LLEVAR (proceso aparte sobre el catalogo general) ── */}
      {isTakeaway && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>🥡</span>
            <div>
              <p className="text-sm font-bold">Estás armando un pedido PARA LLEVAR</p>
              <p className="text-[11px] text-muted-foreground">
                Todo lo que agregues aquí va a tu pedido para llevar, aparte del de la mesa.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={backToDineIn}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Volver al pedido de mesa
          </Button>
        </div>
      )}

      {/* ── Resultado: comanda "impresa" a Cocina/Bar (una por proceso confirmado) ── */}
      {comanda && (
        <div className="flex items-start justify-between gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          <div>
            <p className="text-sm font-bold">
              {comanda.mode === "takeaway" ? "Pedido PARA LLEVAR confirmado" : "🍽️ Pedido de mesa confirmado"}
            </p>
            <p className="mt-0.5 text-xs">
              🖨️ Comanda{comanda.mode === "takeaway" ? " (PARA LLEVAR)" : ""} enviada —{" "}
              <b>Cocina: {comanda.cocina} {comanda.cocina === 1 ? "plato" : "platos"}</b>
              {comanda.bar > 0 && <> · <b>Bar: {comanda.bar} {comanda.bar === 1 ? "bebida" : "bebidas"}</b></>}
            </p>
          </div>
          <button onClick={() => setComanda(null)} aria-label="Cerrar aviso" className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                      <Button size="sm" className="rounded-full" onClick={() => quickAdd(d)}>
                        {isTakeaway ? "🥡 Agregar" : "Agregar"}
                      </Button>
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

      {/* ── Modal de personalizacion del plato (igual en ambos modos) ── */}
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
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold">{modal.dish.name}</h3>
                  {isTakeaway && <Badge className="text-[10px]"> Para llevar</Badge>}
                </div>
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

              {/* Cantidad */}
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
                  {isTakeaway ? "🥡 " : ""}Agregar {money(modal.dish.price * modal.quantity)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Carrito (drawer) — muestra el pedido del modo activo ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setCartOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-bold">
                  {isTakeaway ? "Pedido para llevar" : "Tu pedido · Mesa 7"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isTakeaway ? "🥡 Se te entregará empacado" : "🍽️ Se sirve en la mesa"}
                </p>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Cerrar pedido"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {cart.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Tu pedido está vacío</p>
                </div>
              )}
              {cart.map((l, i) => (
                <div key={i} className="rounded-xl border p-3">
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
                  <div className="mt-2 flex items-center gap-2">
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
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="space-y-2 border-t px-5 py-4">
                <div className="flex justify-between text-sm"><span>Subtotal</span><b>{money(subtotal)}</b></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>ITBIS 18%</span><span>{money(tax)}</span></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>Propina legal 10%</span><span>{money(tip)}</span></div>
                <div className="flex justify-between text-base font-extrabold"><span>Total</span><span>{money(total)}</span></div>

                {isTakeaway ? (
                  // Proceso para llevar: su propia confirmacion + volver al de mesa.
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="lg" onClick={backToDineIn}>
                      <ArrowLeft className="mr-1 h-4 w-4" /> Pedido de mesa
                    </Button>
                    <Button size="lg" onClick={confirmOrder}>Confirmar para llevar</Button>
                  </div>
                ) : (
                  // Pedido de mesa: Confirmar Orden + el boton "Para llevar" AL LADO.
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="lg" onClick={startTakeaway}>
                       Para llevar
                    </Button>
                    <Button size="lg" onClick={confirmOrder}>Confirmar Orden</Button>
                  </div>
                )}
                {!isTakeaway && (
                  <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <UtensilsCrossed className="h-3 w-3" />
                    “Para llevar” abre el menú para armar un pedido aparte
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal "¿Estás seguro?" antes de confirmar (imprime comanda a Cocina/Bar) ── */}
      {confirmMode && (() => {
        const targetCart = confirmMode === "takeaway" ? takeawayCart : dineInCart;
        const { cocina, bar } = splitStations(targetCart);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-2xl">
              <span className="text-4xl" aria-hidden>{confirmMode === "takeaway" ? "🥡" : "🍽️"}</span>
              <h3 className="mt-2 text-lg font-bold">¿Estás seguro?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {confirmMode === "takeaway"
                  ? "Confirmaremos tu pedido PARA LLEVAR y enviaremos la comanda a cocina/bar."
                  : "Confirmaremos tu pedido y enviaremos la comanda a cocina/bar."}
              </p>
              {/* Desglose de a dónde va la comanda */}
              <div className="mt-4 space-y-1.5 rounded-xl border bg-muted/30 p-3 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">🍳 Cocina</span>
                  <b>{cocina} {cocina === 1 ? "plato" : "platos"}</b>
                </div>
                {bar > 0 && (
                  <div className="flex items-center justify-between border-t pt-1.5">
                    <span className="flex items-center gap-1.5">🍹 Bar</span>
                    <b>{bar} {bar === 1 ? "bebida" : "bebidas"}</b>
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" size="lg" onClick={() => setConfirmMode(null)}>Cancelar</Button>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" onClick={doConfirm}>
                  Sí, confirmar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
