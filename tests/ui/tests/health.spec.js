import { test, expect } from '@playwright/test';

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';

test('API health endpoint responds successfully', async ({ request }) => {
  const response = await request.get(`${apiBaseUrl}/api/health`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    status: 'ok',
    service: 'pos-api'
  });
});

test('POS frontend is reachable', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Simple POS' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});
