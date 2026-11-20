import { test, expect } from '../fixtures/auth.js';

test('owner sees owner-only navigation items', async ({ ownerPage }) => {
  for (const name of [
    'Reports',
    'Products',
    'Inventory',
    'Product Categories',
    'Branch Management',
    'Expense Tracker',
    'User Management',
    'Money Receipts',
    'Sales Returns',
    'Customers',
    'Invoices',
    'Settings'
  ]) {
    await expect(ownerPage.getByRole('link', { name, exact: true })).toBeVisible();
  }
});

test('owner can open core read-only pages', async ({ ownerPage }) => {
  const pages = [
    { link: 'Reports', heading: 'Reports', path: '/reports' },
    { link: 'Products', heading: /Product Setup/i, path: '/products' },
    { link: 'Inventory', heading: 'Branch inventory', path: '/inventory' },
    { link: 'Customers', heading: 'Customers', path: '/customers' },
    { link: 'Invoices', heading: /Invoice History/i, path: '/invoices' }
  ];

  for (const item of pages) {
    await ownerPage.getByRole('link', { name: item.link, exact: true }).click();
    await ownerPage.waitForURL(url => url.pathname === item.path);
    await expect(ownerPage.getByRole('heading', { name: item.heading }).first()).toBeVisible();
  }
});
