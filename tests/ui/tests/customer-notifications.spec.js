import { test, expect } from '@playwright/test';

test('owner can view customer notification preferences and account summary action', async ({ page }) => {
  const email = process.env.POS_OWNER_EMAIL;
  const password = process.env.POS_OWNER_PASSWORD;
  const customerId = process.env.POS_TEST_CUSTOMER_ID;
  test.skip(!email || !password || !customerId, 'Configure owner credentials and POS_TEST_CUSTOMER_ID in tests/ui/.env');
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.goto(`/customers/${customerId}`);
  await expect(page.getByText(/notification preferences/i)).toBeVisible();
  await expect(page.getByLabel(/preferred channel/i)).toBeVisible();
  await expect(page.getByLabel(/customer consent/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /queue account summary/i })).toBeVisible();
});
