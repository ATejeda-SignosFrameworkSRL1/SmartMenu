import { test, expect } from '@playwright/test';
import { BASE_URLS } from '../playwright.config';

/**
 * Smoke de los 6 staff logins — cada app debe:
 *   1. Renderizar /login con form visible
 *   2. Aceptar credenciales válidas + acceptedRole
 *   3. Redirigir al / (dashboard) y mostrar contenido autenticado
 *   4. Tener tokens en localStorage tras login
 */

interface AppLogin {
  name: string;
  url: string;
  appKey: string;
  email: string;
  password: string;
  expectedRole: string;
  /** Selector que confirma que el dashboard cargó */
  dashboardLocator: string | RegExp;
}

const APPS: AppLogin[] = [
  {
    name: 'admin-panel',
    url: BASE_URLS.admin,
    appKey: 'admin',
    email: 'admin@smartmenu.com',
    password: 'Admin123!',
    expectedRole: 'Admin',
    dashboardLocator: /Dashboard|Panel|Admin System/i,
  },
  {
    name: 'kds-app',
    url: BASE_URLS.kds,
    appKey: 'kds',
    email: 'chef@smartmenu.com',
    password: 'Chef123!',
    expectedRole: 'Chef',
    dashboardLocator: /Kitchen Display|Todo listo|Cocina/i,
  },
  {
    name: 'waiter-app',
    url: BASE_URLS.waiter,
    appKey: 'waiter',
    email: 'waiter@smartmenu.com',
    password: 'Waiter123!',
    expectedRole: 'Waiter',
    dashboardLocator: /Waiter App|Mesas/i,
  },
  {
    name: 'host-app',
    url: BASE_URLS.host,
    appKey: 'host',
    email: 'host@smartmenu.com',
    password: 'Host123!',
    expectedRole: 'Host',
    dashboardLocator: /Host App|LIBRES|OCUPADAS/i,
  },
  {
    name: 'cashier-app',
    url: BASE_URLS.cashier,
    appKey: 'cashier',
    email: 'cashier@smartmenu.com',
    password: 'Cash123!',
    expectedRole: 'Cashier',
    dashboardLocator: /Caja|Total del día/i,
  },
  {
    name: 'reservation-app',
    url: BASE_URLS.reservation,
    appKey: 'reservation',
    email: 'host@smartmenu.com',
    password: 'Host123!',
    expectedRole: 'Host',
    dashboardLocator: /SmartMenu|Reservar|Experiencia/i,
  },
];

for (const app of APPS) {
  test(`${app.name} — login flow + dashboard renders`, async ({ page }) => {
    // 1. /login renderiza form
    await page.goto(`${app.url}/login`);
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible();

    // 2. Login
    await page.getByLabel(/Correo electrónico/i).fill(app.email);
    await page.getByLabel(/Contraseña/i).fill(app.password);
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    // 3. Redirect a /
    await expect(page).toHaveURL(new RegExp(`${app.url.replace(/[/.]/g, '\\$&')}/?$`), {
      timeout: 10_000,
    });

    // 4. Dashboard contenido visible
    await expect(page.locator('body')).toContainText(app.dashboardLocator, { timeout: 8_000 });

    // 5. Tokens en localStorage
    const token = await page.evaluate((k) => localStorage.getItem(`${k}_token`), app.appKey);
    expect(token, `${app.appKey}_token debe estar set`).toBeTruthy();
    expect(token!.length, `JWT no debe estar vacío`).toBeGreaterThan(50);

    // 6. Role match
    const user = await page.evaluate((k) => {
      const raw = localStorage.getItem(`${k}_user`);
      return raw ? JSON.parse(raw) : null;
    }, app.appKey);
    expect(user?.role, `role mismatch for ${app.name}`).toBe(app.expectedRole);
  });
}
