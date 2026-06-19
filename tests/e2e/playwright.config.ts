import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config para smoke tests del stack QA de SmartMenu.
 *
 * Run:
 *   cd tests/e2e
 *   npm install
 *   npx playwright install --with-deps chromium
 *   npm test
 *
 * Asume que el stack QA está corriendo en localhost:
 *   docker compose -f docker/qa/docker-compose.qa.yml up -d --build
 */

const BASE_URLS = {
  client: process.env.E2E_CLIENT_URL ?? 'https://localhost:8451',
  admin: process.env.E2E_ADMIN_URL ?? 'https://localhost:8444',
  kds: process.env.E2E_KDS_URL ?? 'https://localhost:8445',
  waiter: process.env.E2E_WAITER_URL ?? 'https://localhost:8446',
  host: process.env.E2E_HOST_URL ?? 'https://localhost:8447',
  cashier: process.env.E2E_CASHIER_URL ?? 'https://localhost:8448',
  reservation: process.env.E2E_RESERVATION_URL ?? 'https://localhost:8449',
  api: process.env.E2E_API_URL ?? 'https://localhost:8450',
};

export default defineConfig({
  testDir: './specs',
  fullyParallel: false, // El stack tiene una sola DB; tests modifican estado
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',

  use: {
    // Acepta self-signed certs de Caddy `tls internal`
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

export { BASE_URLS };
