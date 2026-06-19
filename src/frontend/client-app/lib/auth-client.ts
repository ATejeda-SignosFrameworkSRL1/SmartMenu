/**
 * DRY auth — factory que devuelve un axios instance con interceptor JWT
 * + refresh transparente. Reemplaza ~58 líneas duplicadas inline en cada
 * una de las 6 staff apps (admin/waiter/host/kds/cashier/reservation).
 *
 * Uso:
 *   const { api, logout, setSession, getUser } = createAuthApi('admin');
 *   await api.get('/api/dish');   // Authorization: Bearer <admin_token>
 *   logout();                      // limpia localStorage + redirige a /login
 *
 * Por app, localStorage usa el prefijo `${appKey}_`:
 *   admin_token, admin_refresh, admin_user
 *   waiter_token, waiter_refresh, waiter_user
 *   etc.
 *
 * Singleton lock: si llegan 5 requests con token expirado simultáneos,
 * UNA sola va a /api/auth/refresh; las otras 4 esperan ese resultado.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface AuthApiOptions {
  /** Base URL del API. Default: '' (same-origin, Next.js rewrites se encargan). */
  baseURL?: string;
  /** Path al endpoint de refresh. Default: '/api/auth/refresh'. */
  refreshPath?: string;
  /** Path al login. Default: '/login'. */
  loginPath?: string;
  /** Timeout en ms. Default: 15000. */
  timeout?: number;
}

export interface SessionUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  [k: string]: unknown;
}

export interface AuthApi {
  api: AxiosInstance;
  /** Limpia tokens + user del localStorage. NO redirige por sí solo. */
  clear: () => void;
  /** Limpia + redirige a /login (o options.loginPath). */
  logout: () => void;
  /** Guarda access/refresh/user tras un login exitoso. */
  setSession: (_accessToken: string, _refreshToken: string | null, _user: SessionUser) => void;
  /** Lee el user actual del localStorage. null si no hay sesión. */
  getUser: () => SessionUser | null;
  /** Lee el access token. null si no hay. */
  getToken: () => string | null;
}

export function createAuthApi(appKey: string, options: AuthApiOptions = {}): AuthApi {
  const {
    baseURL = '',
    refreshPath = '/api/auth/refresh',
    loginPath = '/login',
    timeout = 15000,
  } = options;

  const TOKEN_KEY = `${appKey}_token`;
  const REFRESH_KEY = `${appKey}_refresh`;
  const USER_KEY = `${appKey}_user`;

  const api = axios.create({ baseURL, timeout, headers: { 'Content-Type': 'application/json' } });

  // Singleton lock — evita refresh paralelo si llegan múltiples 401s simultáneos.
  let refreshPromise: Promise<string | null> | null = null;

  async function tryRefresh(): Promise<string | null> {
    if (refreshPromise) return refreshPromise;
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
    if (!refreshToken) return null;

    refreshPromise = (async () => {
      try {
        const res = await axios.post(baseURL + refreshPath, { refreshToken });
        const { accessToken, refreshToken: newRefresh, user } = res.data ?? {};
        if (!accessToken) return null;
        localStorage.setItem(TOKEN_KEY, accessToken);
        if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        return accessToken as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }

  // Request: inyecta Authorization si hay token.
  api.interceptors.request.use((config) => {
    if (typeof window === 'undefined') return config;
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response: 401 → refresh + retry. Si falla refresh, limpiar + /login.
  // Excepción: si nunca hubo sesión (cliente anónimo a endpoint público), NO redirigir;
  // propagar el error para que el componente muestre toast.error/etc.
  api.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config as (AxiosRequestConfig & { _refreshAttempted?: boolean }) | undefined;
      if (error.response?.status === 401 && original && !original._refreshAttempted) {
        const hadSession = typeof window !== 'undefined' && (
          !!localStorage.getItem(TOKEN_KEY) || !!localStorage.getItem(REFRESH_KEY)
        );
        if (!hadSession) {
          return Promise.reject(error);
        }
        original._refreshAttempted = true;
        const newToken = await tryRefresh();
        if (newToken) {
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
          return api.request(original);
        }
        clear();
        if (typeof window !== 'undefined') window.location.href = loginPath;
      }
      return Promise.reject(error);
    },
  );

  function clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logout(): void {
    clear();
    if (typeof window !== 'undefined') window.location.href = loginPath;
  }

  function setSession(accessToken: string, refreshToken: string | null, user: SessionUser): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getUser(): SessionUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as SessionUser; } catch { return null; }
  }

  function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  return { api, clear, logout, setSession, getUser, getToken };
}
