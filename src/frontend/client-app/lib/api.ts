import axios from 'axios';

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

api.interceptors.request.use((config) => {

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
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export const apiClient = {

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: any) =>
    api.post('/auth/register', data),

  getTables: () =>
    api.get('/table'),

  getTable: (id: number) =>
    api.get(`/table/${id}`),

  getTableByQR: (qrCode: string) =>
    api.get(`/table/qr/${qrCode}`),

  updateTableStatus: (id: number, newStatus: string) =>
    api.put(`/table/${id}/status`, { newStatus }),

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

  getDishTags: () =>
    api.get('/dishtag'),

  getCategories: () =>
    api.get('/category'),

  getCategory: (id: number) =>
    api.get(`/category/${id}`),

  createOrder: (data: any) =>
    api.post('/order', data),

  getActiveOrders: () =>
    api.get('/order/active'),

  getOrder: (orderId: number) =>
    api.get(`/order/${orderId}`),

  updateOrderStatus: (orderId: number, newStatus: string) =>
    api.put(`/order/${orderId}/status`, { newStatus }),

  cancelOrder: (orderId: number, reason?: string) =>
    api.post(`/order/${orderId}/cancel`, { reason: reason ?? '' }),

  markCustomerFinished: (orderId: number) =>
    api.put(`/order/${orderId}/customer-finished`),

  addItemsToOrder: (orderId: number, items: any[]) =>
    api.post(`/order/${orderId}/add-items`, items),

  createPayment: (data: any) =>
    api.post('/payment', data),

  getPayment: (paymentId: number) =>
    api.get(`/payment/${paymentId}`),

  getReceiptByOrder: (orderId: number) =>
    api.get(`/payment/by-order/${orderId}/receipt`),

  requestBilling: (orderId: number, preferences?: {
    paymentMethod?: string;
    tipPercentage?: number;
    tipAmount?: number;
    requiresFiscalReceipt?: boolean;
    rnc?: string;
    businessName?: string;
  }) =>
    api.post(`/payment/request-billing/${orderId}`, preferences ?? {}),

  validateRnc: (rnc: string) =>
    api.get(`/payment/validate-rnc/${rnc}`),
};
