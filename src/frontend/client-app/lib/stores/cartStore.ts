import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  /**
   * Identificador de LINEA del carrito (lo genera el store al agregar; quien
   * llama addItem no lo pasa). Distingue dos lineas del mismo plato con
   * personalizaciones distintas — p.ej. "Filete termino medio" y "Filete bien
   * cocido con alergia a mani" NO deben fusionarse.
   */
  lineId?: string;
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Array<{ modifierId: number; value: string }>;
  notes?: string;
  specialInstructions?: string;
  /** Preferencias y detalles para mostrar en resumen y enviar al pedido */
  customizations?: string;
  allergies?: string;
  meatCooking?: string;
  sideDish?: string;
  drinkTiming?: string;
  withAlcohol?: boolean;
  liga?: string;
  /** 0=Entrada, 1=PlatoFuerte, 2=Postre */
  courseTiming?: number;
}

interface CartState {
  items: CartItem[];
  tableId: number | null;
  restaurantId: number | null;
  /** Nombre del comensal (se pide al entrar al menú tras escanear QR). */
  customerName: string | null;
  /** Si se está agregando a una orden existente (ej. postres), guarda el orderId. */
  addToOrderId: number | null;
  /** Modo PARA LLEVAR: el pedido en curso se confirma como para llevar (marca la
   *  comanda de cocina/bar). Lo activa el botón "Para llevar" del carrito. */
  takeaway: boolean;

  setTableId: (_tableId: number) => void;
  setRestaurantId: (_restaurantId: number) => void;
  setCustomerName: (_name: string | null) => void;
  setAddToOrderId: (_id: number | null) => void;
  setTakeaway: (_v: boolean) => void;

  addItem: (_item: CartItem) => void;
  removeItem: (_lineId: string) => void;
  updateQuantity: (_lineId: string, _quantity: number) => void;
  clearCart: () => void;
  
  getSubtotal: () => number;
  getTax: () => number;
  getTip: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

// crypto.randomUUID no existe en WebViews/Safari viejos (tablets Android del piso).
const genLineId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/** Dos lineas solo se fusionan si TODA la personalizacion coincide (la alergia
 *  o el termino de un comensal no pueden pisarse con los de otro). */
const sameLine = (a: CartItem, b: CartItem) =>
  a.dishId === b.dishId &&
  a.notes === b.notes &&
  a.specialInstructions === b.specialInstructions &&
  a.customizations === b.customizations &&
  a.allergies === b.allergies &&
  a.meatCooking === b.meatCooking &&
  a.sideDish === b.sideDish &&
  a.drinkTiming === b.drinkTiming &&
  a.withAlcohol === b.withAlcohol &&
  a.liga === b.liga &&
  a.courseTiming === b.courseTiming &&
  JSON.stringify(a.modifiers ?? []) === JSON.stringify(b.modifiers ?? []);

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: null,
      restaurantId: null,
      customerName: null,
      addToOrderId: null,
      takeaway: false,

      setTableId: (id) => set({ tableId: id }),
      setRestaurantId: (id) => set({ restaurantId: id }),
      setCustomerName: (name) => set({ customerName: name }),
      setAddToOrderId: (id) => set({ addToOrderId: id }),
      setTakeaway: (v) => set({ takeaway: v }),

      addItem: (newItem) =>
        set((state) => {
          const existing = state.items.find(i => sameLine(i, newItem));

          if (existing) {
            return {
              items: state.items.map(i =>
                i === existing
                  ? { ...i, quantity: i.quantity + newItem.quantity }
                  : i
              ),
            };
          }

          return { items: [...state.items, { ...newItem, lineId: genLineId() }] };
        }),

      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter(i => i.lineId !== lineId),
        })),

      updateQuantity: (lineId, qty) =>
        set((state) => ({
          items: state.items.map(i =>
            i.lineId === lineId ? { ...i, quantity: qty } : i
          ),
        })),

      clearCart: () => set({ items: [], addToOrderId: null, takeaway: false }),

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      },

      getTax: () => {
        const subtotal = get().getSubtotal();
        return subtotal * 0.18; // 18% ITBIS
      },

      getTip: () => {
        const subtotal = get().getSubtotal();
        return subtotal * 0.10; // 10% propina legal
      },

      getTotal: () => {
        const { getSubtotal, getTax, getTip } = get();
        return getSubtotal() + getTax() + getTip();
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'smartmenu-cart',
      // v1: los items ganan lineId. Carritos persistidos antes de esta version
      // no lo traen — se les genera al rehidratar para que removeItem/updateQuantity
      // (keyeados por lineId) sigan funcionando.
      version: 1,
      migrate: (persisted: unknown) => {
        const state = persisted as { items?: CartItem[] } | undefined;
        if (state?.items?.length) {
          state.items = state.items.map(i => (i.lineId ? i : { ...i, lineId: genLineId() }));
        }
        return state as CartState;
      },
    }
  )
);
