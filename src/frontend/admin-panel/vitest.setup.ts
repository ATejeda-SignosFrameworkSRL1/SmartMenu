/**
 * S1.D5 — Vitest setup global.
 * Configura matchers de @testing-library/jest-dom (toBeInTheDocument, toHaveClass...)
 * y limpia el DOM entre tests para evitar fugas de state.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
