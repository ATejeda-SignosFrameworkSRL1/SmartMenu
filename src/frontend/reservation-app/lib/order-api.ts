import axios from 'axios';

// Cliente anónimo: el portal público de pedidos (pickup/delivery) no requiere login.
// Next reescribe /api → backend (igual que booking-api.ts).
const api = axios.create({ baseURL: '' });

export type FulfillmentType = 'Pickup' | 'Delivery';

/** Forma de GET /api/dish (DishDto del backend, camelCase). Sin ?page devuelve array plano. */
export interface MenuDish {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  categoryId?: number | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  isAvailable: boolean;
  preparationTimeMinutes?: number | null;
}

// ── POST /api/invoices (CreateInvoiceDto) ──

export interface CreateInvoiceItem {
  dishId: number;
  quantity: number;
  notes?: string;
  customizations?: string;
  allergies?: string;
}

export interface CreateInvoicePayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  fulfillmentType: FulfillmentType;
  /** Obligatoria cuando fulfillmentType = 'Delivery'. */
  deliveryAddress?: string;
  notes?: string;
  items: CreateInvoiceItem[];
}

// ── Respuesta (InvoiceDto) ──

export interface InvoiceOrderItem {
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoiceOrder {
  orderId: number;
  orderNumber: string;
  restaurantId?: number | null;
  restaurantName?: string | null;
  status: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items: InvoiceOrderItem[];
}

export interface Invoice {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  fulfillmentType: FulfillmentType;
  deliveryAddress?: string | null;
  notes?: string | null;
  subTotal: number;
  taxITBIS: number;
  legalTip: number;
  total: number;
  paymentStatus: string;
  deliveryStatus: string;
  createdAt: string;
  orders: InvoiceOrder[];
}

function extractError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data) {
    const d = e.response.data as { error?: string };
    if (d.error) return d.error;
  }
  return fallback;
}

/** Catálogo público. El backend ya filtra isAvailable sin ?all, pero filtramos defensivamente. */
export async function getMenu(): Promise<MenuDish[]> {
  const { data } = await api.get<MenuDish[] | { items?: MenuDish[] }>('/api/dish');
  const list: MenuDish[] = Array.isArray(data) ? data : data?.items ?? [];
  return list.filter((d) => d.isAvailable);
}

/** Checkout: crea la factura (1 pago → N órdenes por franquicia) y notifica al KDS. */
export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  try {
    const { data } = await api.post<Invoice>('/api/invoices', payload);
    return data;
  } catch (e) {
    throw new Error(extractError(e, 'No se pudo crear el pedido'));
  }
}
