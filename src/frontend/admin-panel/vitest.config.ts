/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * S1.D5 — Vitest config para admin-panel.
 * Reference app del frontend testing setup. Si funciona aquí se replica a las
 * otras 6 apps en sprints siguientes.
 *
 * Run:
 *   cd src/frontend/admin-panel
 *   npm test                       # one-shot (CI)
 *   npm run test:watch             # local dev
 */
export default defineConfig({
  test: {
    globals: true,                  // describe/it/expect sin import
    environment: 'jsdom',           // simula DOM para tests de componentes
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      reportsDirectory: './coverage',
      exclude: ['**/*.config.*', '**/*.setup.*', '.next/**', 'node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
