import axios from 'axios';

const API_URL = '';

export const api = axios.create({
  baseURL: API_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptors
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = 'https://172.31.98.64:3000/login';
    }
    return Promise.reject(error);
  }
);

// API Client
export const apiClient = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: any) =>
    api.post('/auth/register', data),

  // Menu & Dishes
  getMenu: () =>
    api.get('/menu'),

  getDishes: (categoryId?: number) =>
    api.get('/dish', { params: categoryId ? { categoryId } : {} }),

  getDish: (id: number) =>
    api.get(`/dish/${id}`),

  createDish: (data: any) =>
    api.post('/dish', data),

  updateDish: (id: number, data: any) =>
    api.put(`/dish/${id}`, data),

  deleteDish: (id: number) =>
    api.delete(`/dish/${id}`),

  toggleDishAvailability: (id: number) =>
    api.patch(`/dish/${id}/toggle-availability`),

  // Categories
  getCategories: () =>
    api.get('/category'),

  getCategory: (id: number) =>
    api.get(`/category/${id}`),

  // Orders
  getActiveOrders: () =>
    api.get('/order/active'),

  getOrder: (id: number) =>
    api.get(`/order/${id}`),

  updateOrderStatus: (id: number, newStatus: string) =>
    api.put(`/order/${id}/status`, { newStatus }),

  createOrder: (data: any) =>
    api.post('/order', data),

  // Tables
  getTables: () =>
    api.get('/table'),

  getTable: (id: number) =>
    api.get(`/table/${id}`),

  updateTableStatus: (id: number, newStatus: string) =>
    api.put(`/table/${id}/status`, newStatus),

  // Users (para futura implementación)
  getUsers: () =>
    api.get('/user'),

  getUser: (id: number) =>
    api.get(`/user/${id}`),

  createUser: (data: any) =>
    api.post('/user', data),

  updateUser: (id: number, data: any) =>
    api.put(`/user/${id}`, data),

  deleteUser: (id: number) =>
    api.delete(`/user/${id}`),
};
