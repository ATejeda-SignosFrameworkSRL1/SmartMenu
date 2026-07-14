// DELIVERY-TRACKING (PROTOTIPO) — tipos del panel de seguimiento multi-franquicia.
// Espejo del contrato propuesto para /api/invoices (rama feature/invoice-delivery-tracking):
// una factura global pagada una sola vez que por dentro se parte en una orden por
// franquicia. Vive SOLO en el design system + Storybook hasta que se apruebe el rollout.

export type DeliveryStatusKey =
  | "Pending"
  | "Confirmed"
  | "Preparing"
  | "ReadyForPickup"
  | "OutForDelivery"
  | "Delivered"
  | "Cancelled";

export type FulfillmentKey = "Delivery" | "Pickup";

export interface DeliveryOrderItem {
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Orden por franquicia dentro de la factura global (cada KDS procesa solo la suya). */
export interface DeliveryFranchiseOrder {
  orderId: number;
  orderNumber: string;
  restaurantId: number;
  restaurantName: string;
  status: string;
  /** Verdad fiscal POR franquicia (RNC propio): ITBIS/propina se liquidan por orden. */
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items: DeliveryOrderItem[];
}

/** Factura global del checkout online (un pago del cliente; N órdenes por franquicia). */
export interface DeliveryInvoice {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  fulfillmentType: FulfillmentKey;
  deliveryAddress?: string | null;
  notes?: string | null;
  subTotal: number;
  taxITBIS: number;
  legalTip: number;
  total: number;
  paymentStatus: string;
  deliveryStatus: DeliveryStatusKey;
  createdAt: string;
  orders: DeliveryFranchiseOrder[];
}

/** Transiciones válidas del tracking (mismo mapa que usaría el backend/las apps). */
export const DELIVERY_NEXT_STATUS: Record<DeliveryStatusKey, DeliveryStatusKey[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Preparing", "Cancelled"],
  Preparing: ["ReadyForPickup", "Cancelled"],
  ReadyForPickup: ["OutForDelivery", "Delivered"],
  OutForDelivery: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatusKey, string> = {
  Pending: "Pendiente",
  Confirmed: "Confirmada",
  Preparing: "Preparando",
  ReadyForPickup: "Lista para recoger",
  OutForDelivery: "En camino",
  Delivered: "Entregada",
  Cancelled: "Cancelada",
};
