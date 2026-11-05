import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  ownerPage: async ({ page }, use) => {
    const email = process.env.POS_OWNER_EMAIL;
    const password = process.env.POS_OWNER_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'Missing POS_OWNER_EMAIL or POS_OWNER_PASSWORD. Configure tests/ui/.env using .env.example.'
      );
    }

    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/Signed in as/i)).toBeVisible();
    await use(page);
  }
});

export { expect };
