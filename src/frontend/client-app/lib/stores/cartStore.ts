import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {

  lineId?: string;
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Array<{ modifierId: number; value: string }>;
  notes?: string;
  specialInstructions?: string;

  customizations?: string;
  allergies?: string;
  meatCooking?: string;
  sideDish?: string;
  drinkTiming?: string;
  withAlcohol?: boolean;
  liga?: string;

  courseTiming?: number;
}

interface CartState {
  items: CartItem[];
  tableId: number | null;
  restaurantId: number | null;

  customerName: string | null;

  addToOrderId: number | null;

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

const genLineId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

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
        return subtotal * 0.18;
      },

      getTip: () => {
        const subtotal = get().getSubtotal();
        return subtotal * 0.10;
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
