
import type { DeliveryInvoice } from "./types";

export const MOCK_DELIVERY_INVOICES: DeliveryInvoice[] = [
  {
    id: 101,
    customerName: "María Fernández",
    customerPhone: "809-555-0101",
    customerEmail: "maria@example.com",
    fulfillmentType: "Delivery",
    deliveryAddress: "Av. Winston Churchill #45, Piantini",
    notes: "Timbre dañado — llamar al llegar",
    subTotal: 1730.0, taxITBIS: 311.4, legalTip: 173.0, total: 2214.4,
    paymentStatus: "Completed",
    deliveryStatus: "Pending",
    createdAt: "2026-07-14T12:05:00Z",
    orders: [
      {
        orderId: 9001, orderNumber: "ORD-20260714-a1b2c3", restaurantId: 1,
        restaurantName: "La Parrilla Criolla", status: "Pending",
        subtotal: 985.0, tax: 177.3, tip: 98.5, total: 1260.8,
        items: [
          { dishId: 4, dishName: "Ribeye Premium 12oz", quantity: 1, unitPrice: 985.0, subtotal: 985.0 },
        ],
      },
      {
        orderId: 9002, orderNumber: "ORD-20260714-d4e5f6", restaurantId: 2,
        restaurantName: "Sushi Kai", status: "Pending",
        subtotal: 745.0, tax: 134.1, tip: 74.5, total: 953.6,
        items: [
          { dishId: 21, dishName: "Roll Acevichado", quantity: 1, unitPrice: 495.0, subtotal: 495.0 },
          { dishId: 24, dishName: "Gyozas de Cerdo", quantity: 1, unitPrice: 250.0, subtotal: 250.0 },
        ],
      },
    ],
  },
  {
    id: 102,
    customerName: "José Rodríguez",
    customerPhone: "829-555-0202",
    fulfillmentType: "Pickup",
    deliveryAddress: null,
    subTotal: 940.0, taxITBIS: 169.2, legalTip: 94.0, total: 1203.2,
    paymentStatus: "Completed",
    deliveryStatus: "Preparing",
    createdAt: "2026-07-14T11:42:00Z",
    orders: [
      {
        orderId: 9003, orderNumber: "ORD-20260714-g7h8i9", restaurantId: 3,
        restaurantName: "Pizza Nostra", status: "Preparing",
        subtotal: 940.0, tax: 169.2, tip: 94.0, total: 1203.2,
        items: [
          { dishId: 31, dishName: "Pizza Margherita Familiar", quantity: 1, unitPrice: 640.0, subtotal: 640.0 },
          { dishId: 35, dishName: "Calzone de Jamón", quantity: 1, unitPrice: 300.0, subtotal: 300.0 },
        ],
      },
    ],
  },
  {
    id: 103,
    customerName: "Carla Jiménez",
    customerPhone: "849-555-0303",
    fulfillmentType: "Delivery",
    deliveryAddress: "Calle El Vergel #12, El Vergel",
    subTotal: 2185.0, taxITBIS: 393.3, legalTip: 218.5, total: 2796.8,
    paymentStatus: "Completed",
    deliveryStatus: "OutForDelivery",
    createdAt: "2026-07-14T11:10:00Z",
    orders: [
      {
        orderId: 9004, orderNumber: "ORD-20260714-j1k2l3", restaurantId: 1,
        restaurantName: "La Parrilla Criolla", status: "Ready",
        subtotal: 685.0, tax: 123.3, tip: 68.5, total: 876.8,
        items: [
          { dishId: 5, dishName: "Salmón a la Parrilla", quantity: 1, unitPrice: 685.0, subtotal: 685.0 },
        ],
      },
      {
        orderId: 9005, orderNumber: "ORD-20260714-m4n5o6", restaurantId: 2,
        restaurantName: "Sushi Kai", status: "Ready",
        subtotal: 990.0, tax: 178.2, tip: 99.0, total: 1267.2,
        items: [
          { dishId: 22, dishName: "Combo Nigiri (12 pzas)", quantity: 1, unitPrice: 990.0, subtotal: 990.0 },
        ],
      },
      {
        orderId: 9006, orderNumber: "ORD-20260714-p7q8r9", restaurantId: 3,
        restaurantName: "Pizza Nostra", status: "Ready",
        subtotal: 510.0, tax: 91.8, tip: 51.0, total: 652.8,
        items: [
          { dishId: 33, dishName: "Pizza Pepperoni Personal", quantity: 2, unitPrice: 255.0, subtotal: 510.0 },
        ],
      },
    ],
  },
  {
    id: 104,
    customerName: "Luis Peña",
    customerPhone: "809-555-0404",
    fulfillmentType: "Delivery",
    deliveryAddress: "Residencial Las Praderas, Torre B",
    subTotal: 495.0, taxITBIS: 89.1, legalTip: 49.5, total: 633.6,
    paymentStatus: "Completed",
    deliveryStatus: "Delivered",
    createdAt: "2026-07-14T10:20:00Z",
    orders: [
      {
        orderId: 9007, orderNumber: "ORD-20260714-s1t2u3", restaurantId: 2,
        restaurantName: "Sushi Kai", status: "Completed",
        subtotal: 495.0, tax: 89.1, tip: 49.5, total: 633.6,
        items: [
          { dishId: 21, dishName: "Roll Acevichado", quantity: 1, unitPrice: 495.0, subtotal: 495.0 },
        ],
      },
    ],
  },
  {
    id: 105,
    customerName: "Ana Batista",
    customerPhone: "829-555-0505",
    fulfillmentType: "Pickup",
    deliveryAddress: null,
    subTotal: 590.0, taxITBIS: 106.2, legalTip: 59.0, total: 755.2,
    paymentStatus: "Refunded",
    deliveryStatus: "Cancelled",
    createdAt: "2026-07-14T09:55:00Z",
    orders: [
      {
        orderId: 9008, orderNumber: "ORD-20260714-v4w5x6", restaurantId: 1,
        restaurantName: "La Parrilla Criolla", status: "Cancelled",
        subtotal: 590.0, tax: 106.2, tip: 59.0, total: 755.2,
        items: [
          { dishId: 6, dishName: "Pollo Marsala", quantity: 1, unitPrice: 485.0, subtotal: 485.0 },
          { dishId: 12, dishName: "Jugo de Chinola", quantity: 1, unitPrice: 105.0, subtotal: 105.0 },
        ],
      },
    ],
  },
];
