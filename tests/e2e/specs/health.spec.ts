import { test, expect } from '@playwright/test';
import { BASE_URLS } from '../playwright.config';

test.describe('Stack QA health', () => {
  test('API /health/ready devuelve Healthy', async ({ request }) => {
    const res = await request.get(`${BASE_URLS.api}/health/ready`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('Healthy');
  });

  test('Customer-facing endpoints anónimos (P0.1)', async ({ request }) => {
    for (const path of ['/api/menu', '/api/dish', '/api/category', '/api/dishtag', '/api/table']) {
      const res = await request.get(`${BASE_URLS.client}${path}`);
      expect(res.status(), `GET ${path}`).toBe(200);
    }
  });

  test('Mutaciones de catálogo siguen requiriendo JWT', async ({ request }) => {
    const res = await request.post(`${BASE_URLS.admin}/api/dish`, {
      data: { name: 'X', description: 'X', price: 1, categoryId: 1 },
    });
    expect(res.status()).toBe(401);
  });

  test('Security headers presentes', async ({ request }) => {
    const res = await request.get(`${BASE_URLS.client}/`);
    const headers = res.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBeTruthy();
    expect(headers['content-security-policy']).toBeTruthy();
  });
});
