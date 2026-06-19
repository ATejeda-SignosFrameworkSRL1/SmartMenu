import axios from 'axios';

const API_URL = '';

export const api = axios.create({
  baseURL: API_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// S3.2 — JWT refresh transparente:
// Si una request da 401, intentar refresh con el refreshToken guardado. Si OK,
// reintentar la request original con el nuevo accessToken. Si el refresh también
// falla, limpiar credenciales y mandar al /login. Lock para evitar refresh paralelo
// si llegan múltiples 401s simultáneos.
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('admin_refresh');
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await axios.post(API_URL + '/api/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: newRefresh, user } = res.data ?? {};
      if (!accessToken) return null;
      localStorage.setItem('admin_token', accessToken);
      if (newRefresh) localStorage.setItem('admin_refresh', newRefresh);
      if (user) localStorage.setItem('admin_user', JSON.stringify(user));
      return accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function tokenExpiringSoon(token: string, withinMs = 60_000): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return ((payload.exp ?? 0) * 1000) - Date.now() < withinMs;
  } catch {
    return true;
  }
}

/**
 * Token válido para el accessTokenFactory de SignalR: refresca (vía el MISMO `tryRefresh`
 * + lock que el interceptor REST) si está vencido o por vencer. Evita los 401 de
 * reconexión del hub al expirar el token con la pestaña abierta.
 */
export async function ensureFreshToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  const token = localStorage.getItem('admin_token');
  if (token && !tokenExpiringSoon(token)) return token;
  const refreshed = await tryRefresh();
  return refreshed ?? token ?? '';
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._refreshAttempted) {
      original._refreshAttempted = true;
      const newToken = await tryRefresh();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      // Refresh falló o no había refresh token: limpiar y redirigir
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
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
