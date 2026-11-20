import { test, expect } from '../fixtures/auth.js';

test.describe('Invoice creation release-readiness checks', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/invoices/new');
  });

  test('initial payment starts blank, is mandatory and allows zero', async ({ ownerPage }) => {
    const payment = ownerPage.getByLabel('Amount paid now');
    await expect(payment).toHaveValue('');
    await expect(payment).toHaveAttribute('required', '');
    await expect(payment).toHaveAttribute('min', '0');
  });

  test('discount mode, discount value and tax rate are editable', async ({ ownerPage }) => {
    await expect(ownerPage.getByLabel('Discount type')).toBeVisible();
    await expect(ownerPage.getByLabel('Discount value')).toBeEditable();
    await expect(ownerPage.getByLabel('Tax rate (%)')).toBeEditable();
    await expect(ownerPage.getByRole('option', { name: 'Fixed amount (৳)' })).toBeAttached();
    await expect(ownerPage.getByRole('option', { name: 'Percentage (%)' })).toBeAttached();
  });

  test('product picker supports searching by name, SKU or barcode', async ({ ownerPage }) => {
    const picker = ownerPage.getByRole('combobox', { name: 'Search products by name, SKU or barcode' });
    await expect(picker).toBeVisible();
    await picker.fill('cement');
    await expect(ownerPage.getByRole('listbox')).toBeVisible();
  });

  test('mobile navigation opens, scrolls and switches language', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 390, height: 844 });
    const openMenu = ownerPage.getByRole('button', { name: 'Open menu' });
    await expect(openMenu).toBeVisible();
    await openMenu.click();

    await expect(ownerPage.getByRole('button', { name: 'Close menu' })).toBeVisible();
    await expect(ownerPage.locator('.sidebar-scroll')).toHaveCSS('overflow-y', 'auto');
    await expect(ownerPage.getByRole('link', { name: 'Money Receipts' })).toBeVisible();
    await ownerPage.getByRole('button', { name: 'বাংলা' }).click();
    await expect(ownerPage.getByRole('link', { name: 'মানি রিসিপ্ট' })).toBeVisible();
    await expect(ownerPage.getByRole('button', { name: 'মেনু বন্ধ করুন' })).toBeVisible();

    const dimensions = await ownerPage.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  });
});
