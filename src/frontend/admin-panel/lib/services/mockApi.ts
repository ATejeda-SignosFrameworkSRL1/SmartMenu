// Mock API Service - Simula llamadas al backend
import {
  MenuItem,
  MenuCategory,
  Table,
  Order,
  User,
  DashboardStats,
  OrderStatus,
  TableStatus,
  MenuItemStatus,
} from '../types';
import {
  mockMenuItems,
  mockCategories,
  mockTables,
  mockOrders,
  mockUsers,
  generateMockOrder,
  getElapsedMinutes,
} from '../mock-data';

// Simular delay de red
const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== DASHBOARD ====================

export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    await delay(300);
    
    const activeTables = mockTables.filter(t => t.status === 'occupied').length;
    const totalRevenue = mockOrders.reduce((sum, order) => sum + order.total, 0);
    const todayOrders = mockOrders.length;
    
    return {
      todayOrders: 127 + todayOrders,
      todayRevenue: 45234 + totalRevenue,
      activeTables,
      totalTables: mockTables.length,
      activeCustomers: activeTables * 3,
      averageTicket: totalRevenue / todayOrders || 285,
      averagePreparationTime: 23,
      kitchenQueue: mockOrders.filter(o => o.status === 'preparing').length,
      barQueue: 3,
    };
  },

  async getRecentOrders(limit: number = 5): Promise<Order[]> {
    await delay(300);
    return mockOrders.slice(0, limit);
  },
};

// ==================== ÓRDENES ====================

export const ordersApi = {
  async getAll(): Promise<Order[]> {
    await delay(500);
    return [...mockOrders];
  },

  async getById(id: string): Promise<Order | null> {
    await delay(300);
    return mockOrders.find(o => o.id === id) || null;
  },

  async getByTable(tableId: string): Promise<Order[]> {
    await delay(300);
    return mockOrders.filter(o => o.tableId === tableId);
  },

  async getByStatus(status: OrderStatus): Promise<Order[]> {
    await delay(300);
    return mockOrders.filter(o => o.status === status);
  },

  async create(tableNumber: number): Promise<Order> {
    await delay(500);
    const newOrder = generateMockOrder(tableNumber);
    mockOrders.unshift(newOrder);
    return newOrder;
  },

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    await delay(300);
    const order = mockOrders.find(o => o.id === id);
    if (!order) throw new Error('Order not found');
    
    order.status = status;
    order.updatedAt = new Date();
    
    if (status === 'delivered') {
      order.deliveredAt = new Date();
    } else if (status === 'paid') {
      order.paidAt = new Date();
    }
    
    return order;
  },

  async cancel(id: string): Promise<Order> {
    await delay(300);
    return this.updateStatus(id, 'cancelled');
  },
};

// ==================== MENÚ ====================

export const menuApi = {
  async getCategories(): Promise<MenuCategory[]> {
    await delay(300);
    return [...mockCategories];
  },

  async getItems(categoryId?: string): Promise<MenuItem[]> {
    await delay(400);
    if (categoryId) {
      const category = mockCategories.find(c => c.id === categoryId);
      if (!category) return [];
      return mockMenuItems.filter(item => item.category === category.name);
    }
    return [...mockMenuItems];
  },

  async getItemById(id: string): Promise<MenuItem | null> {
    await delay(200);
    return mockMenuItems.find(item => item.id === id) || null;
  },

  async createItem(item: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MenuItem> {
    await delay(500);
    const newItem: MenuItem = {
      ...item,
      id: `item-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockMenuItems.push(newItem);
    return newItem;
  },

  async updateItem(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    await delay(500);
    const index = mockMenuItems.findIndex(item => item.id === id);
    if (index === -1) throw new Error('Item not found');
    
    mockMenuItems[index] = {
      ...mockMenuItems[index],
      ...data,
      updatedAt: new Date(),
    };
    return mockMenuItems[index];
  },

  async deleteItem(id: string): Promise<void> {
    await delay(400);
    const index = mockMenuItems.findIndex(item => item.id === id);
    if (index !== -1) {
      mockMenuItems.splice(index, 1);
    }
  },

  async toggleStatus(id: string): Promise<MenuItem> {
    await delay(300);
    const item = mockMenuItems.find(i => i.id === id);
    if (!item) throw new Error('Item not found');
    
    item.status = item.status === 'available' ? 'unavailable' : 'available';
    item.updatedAt = new Date();
    return item;
  },
};

// ==================== MESAS ====================

export const tablesApi = {
  async getAll(): Promise<Table[]> {
    await delay(300);
    return [...mockTables];
  },

  async getById(id: string): Promise<Table | null> {
    await delay(200);
    return mockTables.find(t => t.id === id) || null;
  },

  async getByStatus(status: TableStatus): Promise<Table[]> {
    await delay(300);
    return mockTables.filter(t => t.status === status);
  },

  async updateStatus(id: string, status: TableStatus): Promise<Table> {
    await delay(300);
    const table = mockTables.find(t => t.id === id);
    if (!table) throw new Error('Table not found');
    
    table.status = status;
    if (status === 'available') {
      table.currentSession = undefined;
      table.assignedWaiter = undefined;
    }
    return table;
  },

  async assignWaiter(tableId: string, waiterId: string): Promise<Table> {
    await delay(300);
    const table = mockTables.find(t => t.id === tableId);
    if (!table) throw new Error('Table not found');
    
    table.assignedWaiter = waiterId;
    return table;
  },
};

// ==================== USUARIOS ====================

export const usersApi = {
  async getAll(): Promise<User[]> {
    await delay(400);
    return [...mockUsers];
  },

  async getById(id: string): Promise<User | null> {
    await delay(200);
    return mockUsers.find(u => u.id === id) || null;
  },

  async getByRole(role: string): Promise<User[]> {
    await delay(300);
    return mockUsers.filter(u => u.role === role);
  },

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    await delay(500);
    const newUser: User = {
      ...user,
      id: `user-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockUsers.push(newUser);
    return newUser;
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    await delay(400);
    const index = mockUsers.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    
    mockUsers[index] = {
      ...mockUsers[index],
      ...data,
      updatedAt: new Date(),
    };
    return mockUsers[index];
  },

  async toggleActive(id: string): Promise<User> {
    await delay(300);
    const user = mockUsers.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    
    user.isActive = !user.isActive;
    user.updatedAt = new Date();
    return user;
  },

  async delete(id: string): Promise<void> {
    await delay(400);
    const index = mockUsers.findIndex(u => u.id === id);
    if (index !== -1) {
      mockUsers.splice(index, 1);
    }
  },
};

// ==================== COCINA/BAR ====================

export const kitchenApi = {
  async getActiveOrders(destination: 'kitchen' | 'bar'): Promise<Order[]> {
    await delay(400);
    return mockOrders.filter(order => {
      // Filtrar órdenes que tengan items para cocina/bar
      const hasDestinationItems = order.items.some(
        item => item.menuItem.destination === destination
      );
      return hasDestinationItems && ['preparing', 'ready'].includes(order.status);
    });
  },

  async markItemReady(orderId: string, itemId: string): Promise<Order> {
    await delay(300);
    const order = mockOrders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');
    
    const item = order.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found');
    
    item.status = 'ready';
    item.completedAt = new Date();
    
    // Si todos los items están listos, actualizar el estado de la orden
    const allReady = order.items.every(i => i.status === 'ready');
    if (allReady) {
      order.status = 'ready';
      order.updatedAt = new Date();
    }
    
    return order;
  },
};

// ==================== REPORTES ====================

export const reportsApi = {
  async getSalesData(startDate: Date, endDate: Date): Promise<any> {
    await delay(600);
    return {
      totalSales: 125340,
      totalOrders: 423,
      averageTicket: 296,
      paymentMethods: {
        cash: 45000,
        card: 65340,
        transfer: 15000,
      },
      topProducts: [
        { name: 'Filete Mignon', quantity: 45, revenue: 21825 },
        { name: 'Lasagna Bolognesa', quantity: 38, revenue: 10450 },
        { name: 'Salmón a la Parrilla', quantity: 32, revenue: 12640 },
      ],
      hourlyData: Array.from({ length: 12 }, (_, i) => ({
        hour: i + 12,
        orders: Math.floor(Math.random() * 30) + 10,
        revenue: Math.floor(Math.random() * 8000) + 2000,
      })),
    };
  },
};

// Exportar todo el API
export const mockApi = {
  dashboard: dashboardApi,
  orders: ordersApi,
  menu: menuApi,
  tables: tablesApi,
  users: usersApi,
  kitchen: kitchenApi,
  reports: reportsApi,
};

export default mockApi;
