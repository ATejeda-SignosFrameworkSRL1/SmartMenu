import axios from 'axios';

// En el navegador: mismo host; si la página es HTTPS usamos puerto 5042 (API HTTPS), si no 5041 (API HTTP)
function getApiBaseUrl(): string {
  return '';
}

const API_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptors
api.interceptors.request.use((config) => {
  // Agregar token si existe
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado, limpiar y redirigir
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// API Methods
export const apiClient = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: any) =>
    api.post('/auth/register', data),

  // Table
  getTables: () =>
    api.get('/table'),

  getTable: (id: number) =>
    api.get(`/table/${id}`),

  getTableByQR: (qrCode: string) =>
    api.get(`/table/qr/${qrCode}`),

  updateTableStatus: (id: number, newStatus: string) =>
    api.put(`/table/${id}/status`, { newStatus }),

  // Menu
  getMenu: () =>
    api.get('/menu'),

  getMenuByRestaurant: (restaurantId: number) =>
    api.get(`/menu/restaurant/${restaurantId}`),

  getDishes: (categoryId?: number) =>
    api.get('/dish', { params: categoryId ? { categoryId } : {} }),

  getDish: (dishId: number) =>
    api.get(`/dish/${dishId}`),

  toggleDishAvailability: (dishId: number) =>
    api.patch(`/dish/${dishId}/toggle-availability`),

  // Categories
  getCategories: () =>
    api.get('/category'),

  getCategory: (id: number) =>
    api.get(`/category/${id}`),

  // Orders
  createOrder: (data: any) =>
    api.post('/order', data),

  getActiveOrders: () =>
    api.get('/order/active'),

  getOrder: (orderId: number) =>
    api.get(`/order/${orderId}`),

  updateOrderStatus: (orderId: number, newStatus: string) =>
    api.put(`/order/${orderId}/status`, { newStatus }),

  markCustomerFinished: (orderId: number) =>
    api.put(`/order/${orderId}/customer-finished`),

  // Payments
  createPayment: (data: any) =>
    api.post('/payment', data),

  getPayment: (paymentId: number) =>
    api.get(`/payment/${paymentId}`),
};
