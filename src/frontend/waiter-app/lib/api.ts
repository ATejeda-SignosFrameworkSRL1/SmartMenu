import axios from 'axios';

function getApiBaseUrl(): string {
  return '';
}

const API_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('waiter_refresh');
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await axios.post(API_URL + '/api/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: newRefresh, user } = res.data ?? {};
      if (!accessToken) return null;
      localStorage.setItem('waiter_token', accessToken);
      if (newRefresh) localStorage.setItem('waiter_refresh', newRefresh);
      if (user) localStorage.setItem('waiter_user', JSON.stringify(user));
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

export async function ensureFreshToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  const token = localStorage.getItem('waiter_token');
  if (token && !tokenExpiringSoon(token)) return token;
  const refreshed = await tryRefresh();
  return refreshed ?? token ?? '';
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('waiter_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
      localStorage.removeItem('waiter_token');
      localStorage.removeItem('waiter_refresh');
      localStorage.removeItem('waiter_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
