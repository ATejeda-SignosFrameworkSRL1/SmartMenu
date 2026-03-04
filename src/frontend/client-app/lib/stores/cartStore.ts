import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
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
}

interface CartState {
  items: CartItem[];
  tableId: number | null;
  restaurantId: number | null;
  /** Nombre del comensal (se pide al entrar al menú tras escanear QR). */
  customerName: string | null;

  setTableId: (tableId: number) => void;
  setRestaurantId: (restaurantId: number) => void;
  setCustomerName: (name: string | null) => void;
  
  addItem: (item: CartItem) => void;
  removeItem: (dishId: number) => void;
  updateQuantity: (dishId: number, quantity: number) => void;
  clearCart: () => void;
  
  getSubtotal: () => number;
  getTax: () => number;
  getTip: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: null,
      restaurantId: null,
      customerName: null,

      setTableId: (id) => set({ tableId: id }),
      setRestaurantId: (id) => set({ restaurantId: id }),
      setCustomerName: (name) => set({ customerName: name }),

      addItem: (newItem) =>
        set((state) => {
          const existingItem = state.items.find(i => i.dishId === newItem.dishId);
          
          if (existingItem) {
            return {
              items: state.items.map(i =>
                i.dishId === newItem.dishId
                  ? { ...i, quantity: i.quantity + newItem.quantity }
                  : i
              ),
            };
          }
          
          return { items: [...state.items, newItem] };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter(i => i.dishId !== id),
        })),

      updateQuantity: (id, qty) =>
        set((state) => ({
          items: state.items.map(i =>
            i.dishId === id ? { ...i, quantity: qty } : i
          ),
        })),

      clearCart: () => set({ items: [] }),

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
    }
  )
);
