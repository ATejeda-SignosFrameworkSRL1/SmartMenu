// ==================== TIPOS GENERALES ====================

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type MenuItemStatus = 'available' | 'unavailable' | 'out_of_stock';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'digital_wallet';
export type UserRole = 'admin' | 'manager' | 'waiter' | 'chef' | 'bartender' | 'cashier';

// ==================== MENÚ ====================

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image?: string;
  status: MenuItemStatus;
  preparationTime: number; // en minutos
  destination: 'kitchen' | 'bar' | 'drinks_station';
  allergens?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isSpicy?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  order: number;
  icon?: string;
  isActive: boolean;
}

// ==================== MESAS ====================

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  currentSession?: string;
  assignedWaiter?: string;
  zone?: string;
  positionX?: number;
  positionY?: number;
  qrCode?: string;
}

export interface TableSession {
  id: string;
  tableId: string;
  tableNumber: number;
  startTime: Date;
  endTime?: Date;
  customerCount: number;
  waiterId?: string;
  waiterName?: string;
  status: 'active' | 'closed';
  total: number;
}

// ==================== ÓRDENES ====================

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  customizations?: string[];
  allergies?: string[]; // Alergias del cliente (para mostrar alertas)
  hasAllergies?: boolean; // Flag rápido para detectar alergias
  specialInstructions?: string; // Instrucciones especiales
  status: OrderItemStatus;
  createdAt: Date;
  completedAt?: Date;
}

export interface Order {
  id: string;
  orderNumber: number;
  tableId: string;
  tableNumber: number;
  sessionId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  tip?: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  allergies?: string[]; // Alergias generales de la mesa
  waiterId?: string;
  waiterName?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  paidAt?: Date;
}

// ==================== COCINA/BAR ====================

export interface KitchenOrderItem extends OrderItem {
  priority: 'normal' | 'high' | 'urgent';
  elapsedTime: number; // en minutos
  allergies?: string[];
}

export interface KitchenOrder {
  id: string;
  orderNumber: number;
  tableNumber: number;
  items: KitchenOrderItem[];
  createdAt: Date;
  elapsedTime: number;
  priority: 'normal' | 'high' | 'urgent';
  status: OrderStatus;
}

// ==================== USUARIOS ====================

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  avatar?: string;
  assignedZone?: string;
  pin?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== PAGOS ====================

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: number;
  amount: number;
  paymentMethod: PaymentMethod;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  processedAt?: Date;
  createdAt: Date;
}

export interface CashRegister {
  id: string;
  openedBy: string;
  openedAt: Date;
  closedBy?: string;
  closedAt?: Date;
  initialAmount: number;
  finalAmount?: number;
  totalSales?: number;
  totalCash?: number;
  totalCard?: number;
  totalTransfer?: number;
  status: 'open' | 'closed';
}

// ==================== REPORTES ====================

export interface SalesReport {
  date: string;
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  totalTips: number;
  paymentMethods: {
    cash: number;
    card: number;
    transfer: number;
    digitalWallet: number;
  };
}

export interface ProductReport {
  menuItemId: string;
  name: string;
  category: string;
  quantitySold: number;
  revenue: number;
  averageRating?: number;
}

export interface TimeReport {
  hour: number;
  orders: number;
  revenue: number;
  averagePreparationTime: number;
}

// ==================== ESTADÍSTICAS ====================

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  activeTables: number;
  totalTables: number;
  activeCustomers: number;
  averageTicket: number;
  averagePreparationTime: number;
  kitchenQueue: number;
  barQueue: number;
}

// ==================== NOTIFICACIONES ====================

export interface Notification {
  id: string;
  type: 'order_ready' | 'table_request' | 'order_delayed' | 'payment_received' | 'alert';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  createdAt: Date;
  relatedId?: string; // ID de orden, mesa, etc.
}
