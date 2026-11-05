import { test, expect } from '@playwright/test';

test('salesman sees assigned branch and does not see owner-only navigation', async ({ page }) => {
  const email = process.env.POS_SALESMAN_EMAIL;
  const password = process.env.POS_SALESMAN_PASSWORD;
  test.skip(!email || !password, 'Optional Salesman credentials are not configured in tests/ui/.env');

  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText(/Signed in as .*\(salesman\)/i)).toBeVisible();
  await expect(page.getByText('Assigned branch', { exact: true })).toBeVisible();

  for (const name of ['Product Categories', 'Branch Management', 'Expense Tracker', 'User Management']) {
    await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
  }

  await expect(page.getByRole('link', { name: 'Inventory', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Invoices', exact: true })).toBeVisible();
});
