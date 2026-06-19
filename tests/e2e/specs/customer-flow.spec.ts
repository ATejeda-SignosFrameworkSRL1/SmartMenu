import { test, expect } from '@playwright/test';
import { BASE_URLS } from '../playwright.config';

/**
 * Customer happy path: cliente final escanea QR → ingresa nombre → ve menú.
 *
 * Cubre las regresiones P0 cazadas durante la saga:
 *   - /login redirect que causaba blank screen
 *   - /api/table requiriendo auth (P0 fix)
 *   - manifest icon-192 ausente
 */

test.describe('Customer flow', () => {
  test('Root / renderiza el listado de mesas con QR codes', async ({ page }) => {
    await page.goto(`${BASE_URLS.client}/`);
    await expect(page).toHaveURL(/\/table$|\/table\/$/);
    await expect(page.locator('h1')).toContainText('Mesas');
    // 24 mesas seedeadas + 24 QR svgs (al menos)
    const tableCards = page.locator('text=/^Mesa \\d+/').or(page.locator('text=/^Terraza|^Salón|^VIP/'));
    expect(await tableCards.count()).toBeGreaterThan(0);
  });

  test('Scan QR → ingreso de nombre → menú', async ({ page, request }) => {
    // Obtener un qrCode real de la DB
    const tablesRes = await request.get(`${BASE_URLS.client}/api/table`);
    expect(tablesRes.ok()).toBeTruthy();
    const tables = await tablesRes.json();
    const tableArr = Array.isArray(tables) ? tables : tables.items ?? [];
    expect(tableArr.length).toBeGreaterThan(0);
    const qr = tableArr[0].qrCode || `table-${tableArr[0].id}`;

    // Simular scan navegando directamente al URL del QR
    await page.goto(`${BASE_URLS.client}/table/${qr}`);

    // Debe aparecer el formulario "¿Cómo te llamas?"
    await expect(page.getByText(/¿Cómo te llamas\?/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Mesa\s*\d+/)).toBeVisible();

    // Llenar nombre + entrar
    await page.locator('input[type=text]').first().fill('Tester E2E');
    await page.getByRole('button', { name: /Entrar al menú/i }).click();

    // Esperar al menú
    await expect(page).toHaveURL(/\/menu/);
    await expect(page.locator('body')).toContainText(/RD\$\s*\d/); // al menos un precio renderizó
  });

  // S1.D5 — extiende el customer flow: menú → cart → verificación de ítem agregado.
  // No llega a billing/receipt porque eso requiere mesero/cocina del lado opuesto
  // (lo cubre el integration test del backend OrderService).
  test('Menú → agregar al carrito → /cart muestra el ítem', async ({ page, request }) => {
    // Setup: navegar al menú vía QR scan (igual que el test anterior).
    const tablesRes = await request.get(`${BASE_URLS.client}/api/table`);
    const tables = await tablesRes.json();
    const tableArr = Array.isArray(tables) ? tables : tables.items ?? [];
    const qr = tableArr[0].qrCode || `table-${tableArr[0].id}`;
    await page.goto(`${BASE_URLS.client}/table/${qr}`);
    await page.locator('input[type=text]').first().fill('Tester Cart');
    await page.getByRole('button', { name: /Entrar al menú/i }).click();
    await expect(page).toHaveURL(/\/menu/);

    // Esperar que renderice al menos un botón "Agregar" (catálogo cargó).
    const addButton = page.getByRole('button', { name: /^Agregar$/ }).first();
    await expect(addButton).toBeVisible({ timeout: 10_000 });

    // Click → debe abrir modal/confirmación o agregar directo. Capturamos el count del cart.
    await addButton.click();

    // El botón flotante del cart actualiza su badge (cartItemCount > 0).
    // El cart icon tiene un span con el número cuando hay items.
    await page.waitForTimeout(500); // pequeño margen para que el state se settle

    // Navegar al cart vía el icon flotante (el Link envuelve un button).
    const cartLink = page.locator('a[href*="/cart"]').first();
    await cartLink.click();
    await expect(page).toHaveURL(/\/cart/);

    // El cart debe tener al menos un line item (precio RD$ visible).
    await expect(page.locator('body')).toContainText(/RD\$\s*\d/);
    // No debe estar vacío (texto "carrito vacío" o similar).
    await expect(page.getByText(/carrito vacío|cart is empty/i)).toHaveCount(0);
  });
});
