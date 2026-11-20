import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';

test('owner can sign in with valid credentials', async ({ page }) => {
  const email = process.env.POS_OWNER_EMAIL;
  const password = process.env.POS_OWNER_PASSWORD;
  test.skip(!email || !password, 'Owner credentials are not configured in tests/ui/.env');

  const login = new LoginPage(page);
  await login.open();
  await login.signIn(email, password);

  await expect(page.getByText(/Signed in as/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});

test('invalid credentials show an authentication error', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.signIn('invalid-user@example.invalid', 'InvalidPassword123!');

  await expect(login.errorMessage).toContainText(/incorrect|invalid|failed/i);
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('owner can sign out', async ({ page }) => {
  const email = process.env.POS_OWNER_EMAIL;
  const password = process.env.POS_OWNER_PASSWORD;
  test.skip(!email || !password, 'Owner credentials are not configured in tests/ui/.env');

  const login = new LoginPage(page);
  await login.open();
  await login.signIn(email, password);
  await expect(page.getByText(/Signed in as/i)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
});
