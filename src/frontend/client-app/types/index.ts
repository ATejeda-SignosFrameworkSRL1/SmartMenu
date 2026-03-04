// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// Table Types
export interface TableInfo {
  id: number;
  tableNumber: string;
  restaurantId: number;
  restaurantName: string;
  logo: string | null;
  zoneName: string | null;
  status: string;
  capacity: number;
}

// Menu Types (Ajustado al backend real)
export interface Menu {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  categories: Category[];
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  dishes: Dish[];
}

export interface Dish {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  categoryId: number;
  categoryName: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  preparationTimeMinutes: number;
}

export interface Modifier {
  id: number;
  name: string;
  type: string;
  price: number;
  options: string[];
}

// Order Types (Ajustado al backend real)
export interface Order {
  id: number;
  orderNumber: string;
  tableId: number;
  tableNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  createdAt: string;
  specialInstructions?: string | null;
  items: OrderItem[];
}

export interface OrderItem {
  id: number;
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
  isReady: boolean;
}

export interface CreateOrderRequest {
  tableId: number;
  sessionId: string;
  specialInstructions?: string;
  items: {
    dishId: number;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

// Cart Types
export interface CartItem {
  dishId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Array<{ modifierId: number; value: string }>;
  specialInstructions?: string;
}
