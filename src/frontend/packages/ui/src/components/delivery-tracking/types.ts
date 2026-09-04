
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

export interface DeliveryFranchiseOrder {
  orderId: number;
  orderNumber: string;
  restaurantId: number;
  restaurantName: string;
  status: string;

  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items: DeliveryOrderItem[];
}

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
