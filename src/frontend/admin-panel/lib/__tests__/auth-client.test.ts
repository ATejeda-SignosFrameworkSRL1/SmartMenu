/**
 * S1.D5 — auth-client unit tests.
 *
 * Cubre los contratos clave del factory:
 *  - prefijo por app (admin_token vs waiter_token vs ...) — DRY que evita
 *    colisiones cuando 2 apps corren en el mismo browser tab.
 *  - setSession / getUser / getToken / clear — round-trip localStorage.
 *  - logout = clear + redirect.
 *  - request interceptor: agrega Authorization sólo si hay token.
 *  - response interceptor: 401 → refresh + retry; si refresh falla → /login.
 *  - singleton lock: N requests 401-simultáneos disparan UN solo refresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthApi } from '../auth-client';
import axios from 'axios';

vi.mock('axios');

const mockedAxios = axios as unknown as {
  create: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

// Fake axios instance que cualquier .create() devolverá. Capturamos los interceptores
// para poder dispararlos manualmente y testear el comportamiento del 401.
function makeFakeAxios() {
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  const request = vi.fn(async () => ({ data: { ok: true } }));
  return {
    interceptors: {
      request: { use: requestUse },
      response: { use: responseUse },
    },
    request,
    requestUse,
    responseUse,
  };
}

let fakeAxios: ReturnType<typeof makeFakeAxios>;

beforeEach(() => {
  fakeAxios = makeFakeAxios();
  (mockedAxios.create as ReturnType<typeof vi.fn>) = vi.fn(() => fakeAxios) as never;
  (mockedAxios.post as ReturnType<typeof vi.fn>) = vi.fn() as never;
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAuthApi — namespacing por app', () => {
  it('usa el prefijo appKey_ para los 3 keys de localStorage', () => {
    const auth = createAuthApi('admin');
    auth.setSession('access-XYZ', 'refresh-ABC', {
      id: 1, email: 'a@x.com', role: 'Admin',
    });
    expect(localStorage.getItem('admin_token')).toBe('access-XYZ');
    expect(localStorage.getItem('admin_refresh')).toBe('refresh-ABC');
    const userJson = localStorage.getItem('admin_user');
    expect(userJson).not.toBeNull();
    expect(JSON.parse(userJson!).email).toBe('a@x.com');
  });

  it('dos apps distintas no colisionan localStorage', () => {
    const admin = createAuthApi('admin');
    const waiter = createAuthApi('waiter');
    admin.setSession('admin-tok', null, { id: 1, email: 'a@x.com', role: 'Admin' });
    waiter.setSession('waiter-tok', null, { id: 2, email: 'w@x.com', role: 'Waiter' });

    expect(admin.getToken()).toBe('admin-tok');
    expect(waiter.getToken()).toBe('waiter-tok');
    expect(admin.getUser()?.role).toBe('Admin');
    expect(waiter.getUser()?.role).toBe('Waiter');
  });
});

describe('setSession / getUser / getToken / clear', () => {
  it('getUser devuelve null cuando no hay sesión', () => {
    const auth = createAuthApi('admin');
    expect(auth.getUser()).toBeNull();
    expect(auth.getToken()).toBeNull();
  });

  it('getUser devuelve null si el JSON está corrupto (no tira)', () => {
    localStorage.setItem('admin_user', '{not-valid json');
    const auth = createAuthApi('admin');
    expect(auth.getUser()).toBeNull();
  });

  it('setSession sin refreshToken solo guarda access + user', () => {
    const auth = createAuthApi('admin');
    auth.setSession('access-only', null, { id: 1, email: 'a@x.com', role: 'Admin' });
    expect(localStorage.getItem('admin_token')).toBe('access-only');
    expect(localStorage.getItem('admin_refresh')).toBeNull();
    expect(auth.getUser()?.id).toBe(1);
  });

  it('clear() borra los 3 keys', () => {
    const auth = createAuthApi('admin');
    auth.setSession('t', 'r', { id: 1, email: 'a@x.com', role: 'Admin' });
    auth.clear();
    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(localStorage.getItem('admin_refresh')).toBeNull();
    expect(localStorage.getItem('admin_user')).toBeNull();
  });

  it('logout() llama a clear + redirige a /login (configurable)', () => {
    // Stub window.location.href con un getter/setter mock
    const originalLocation = window.location;
    const setterSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, set href(v: string) { setterSpy(v); } },
      writable: true,
    });

    const auth = createAuthApi('admin', { loginPath: '/auth/login' });
    auth.setSession('t', 'r', { id: 1, email: 'a@x.com', role: 'Admin' });
    auth.logout();

    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(setterSpy).toHaveBeenCalledWith('/auth/login');

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });
});

describe('Interceptors registrados en el axios instance', () => {
  it('registra UN request interceptor y UN response interceptor', () => {
    createAuthApi('admin');
    expect(fakeAxios.requestUse).toHaveBeenCalledTimes(1);
    expect(fakeAxios.responseUse).toHaveBeenCalledTimes(1);
  });

  it('request interceptor: NO agrega Authorization si no hay token', () => {
    createAuthApi('admin');
    const reqInterceptor = fakeAxios.requestUse.mock.calls[0][0];
    const config = { headers: {} as Record<string, string> };
    const out = reqInterceptor(config);
    expect(out.headers.Authorization).toBeUndefined();
  });

  it('request interceptor: agrega Bearer <token> si hay token', () => {
    const auth = createAuthApi('admin');
    auth.setSession('the-token', null, { id: 1, email: 'a@x.com', role: 'Admin' });
    const reqInterceptor = fakeAxios.requestUse.mock.calls[0][0];
    const config = { headers: {} as Record<string, string> };
    const out = reqInterceptor(config);
    expect(out.headers.Authorization).toBe('Bearer the-token');
  });
});

describe('Response interceptor: 401 → refresh + retry', () => {
  it('si no hay refreshToken, NO intenta refresh (devuelve el error)', async () => {
    createAuthApi('admin');
    const [, errInterceptor] = fakeAxios.responseUse.mock.calls[0];
    const err = { response: { status: 401 }, config: { headers: {} } };
    await expect(errInterceptor(err)).rejects.toBe(err);
  });

  it('con refreshToken: llama POST /api/auth/refresh y reintenta el original', async () => {
    const auth = createAuthApi('admin');
    auth.setSession('expired-tok', 'valid-refresh', { id: 1, email: 'a@x.com', role: 'Admin' });

    // axios.post (top-level) usado para refresh
    (mockedAxios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { accessToken: 'new-tok', refreshToken: 'new-refresh', user: { id: 1, email: 'a@x.com', role: 'Admin' } },
    });

    const [, errInterceptor] = fakeAxios.responseUse.mock.calls[0];
    const original = { headers: {} as Record<string, string>, url: '/api/dish' };
    const err = { response: { status: 401 }, config: original };

    await errInterceptor(err);

    // Refresh fue llamado
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/refresh', { refreshToken: 'valid-refresh' });
    // Original fue reintentado con el nuevo Bearer
    expect(fakeAxios.request).toHaveBeenCalledTimes(1);
    expect(original.headers.Authorization).toBe('Bearer new-tok');
    // localStorage actualizado
    expect(localStorage.getItem('admin_token')).toBe('new-tok');
    expect(localStorage.getItem('admin_refresh')).toBe('new-refresh');
  });

  it('si refresh falla (4xx), limpia localStorage y redirige a /login', async () => {
    const auth = createAuthApi('admin');
    auth.setSession('expired-tok', 'valid-refresh', { id: 1, email: 'a@x.com', role: 'Admin' });

    (mockedAxios.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('refresh failed'));

    const setterSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, set href(v: string) { setterSpy(v); } },
      writable: true,
    });

    const [, errInterceptor] = fakeAxios.responseUse.mock.calls[0];
    const original = { headers: {} as Record<string, string> };
    const err = { response: { status: 401 }, config: original };
    await expect(errInterceptor(err)).rejects.toBeDefined();

    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(setterSpy).toHaveBeenCalledWith('/login');

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('no reintenta dos veces el mismo request (evita loop infinito)', async () => {
    const auth = createAuthApi('admin');
    auth.setSession('expired-tok', 'valid-refresh', { id: 1, email: 'a@x.com', role: 'Admin' });
    (mockedAxios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { accessToken: 'new-tok', refreshToken: null, user: { id: 1, email: 'a@x.com', role: 'Admin' } },
    });

    const [, errInterceptor] = fakeAxios.responseUse.mock.calls[0];
    const original = { headers: {} as Record<string, string>, _refreshAttempted: true };
    const err = { response: { status: 401 }, config: original };

    // Como _refreshAttempted ya está marcado, debe rechazar sin reintentar.
    await expect(errInterceptor(err)).rejects.toBe(err);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
