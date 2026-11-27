import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoicePricing, normalizeInitialPayment } from '../../backend/src/utils/invoicePricing.js';

test('fixed discount is deducted before percentage tax', () => {
  assert.deepEqual(
    calculateInvoicePricing({ subtotal: 570, discountType: 'fixed', discountValue: 50, taxRate: 10 }),
    { subtotal: 570, discountType: 'fixed', discountValue: 50, discount: 50, taxRate: 10, taxAmount: 52, total: 572 }
  );
});

test('percentage discount is converted to a stored monetary discount', () => {
  assert.deepEqual(
    calculateInvoicePricing({ subtotal: 570, discountType: 'percentage', discountValue: 10, taxRate: 10 }),
    { subtotal: 570, discountType: 'percentage', discountValue: 10, discount: 57, taxRate: 10, taxAmount: 51.3, total: 564.3 }
  );
});

test('currency calculations round to two decimal places', () => {
  assert.deepEqual(
    calculateInvoicePricing({ subtotal: 0.1 + 0.2, discountType: 'fixed', discountValue: 0.01, taxRate: 10 }),
    { subtotal: 0.3, discountType: 'fixed', discountValue: 0.01, discount: 0.01, taxRate: 10, taxAmount: 0.03, total: 0.32 }
  );
});

test('legacy fixed discount defaults remain compatible', () => {
  const result = calculateInvoicePricing({ subtotal: 100, discountType: 'fixed', discountValue: 15, taxRate: 0 });
  assert.equal(result.discount, 15);
  assert.equal(result.total, 85);
});

test('discounts cannot exceed the subtotal or 100 percent', () => {
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, discountType: 'fixed', discountValue: 101 }), /cannot exceed subtotal/i);
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, discountType: 'percentage', discountValue: 101 }), /cannot exceed 100/i);
});

test('tax rates must be non-negative and may exceed 100 percent', () => {
  const pricing = calculateInvoicePricing({ subtotal: 100, taxRate: 125 });
  assert.equal(pricing.taxAmount, 125);
  assert.equal(pricing.total, 225);
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, taxRate: -0.01 }), /non-negative/i);
});

test('invalid and negative monetary inputs are rejected', () => {
  assert.throws(() => calculateInvoicePricing({ subtotal: -1 }), /non-negative/i);
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, discountValue: 'not-a-number' }), /non-negative/i);
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, discountType: 'invalid' }), /discount type/i);
});

test('explicit zero initial payment is valid', () => {
  assert.deepEqual(normalizeInitialPayment({ paidAmount: '0', cashAmount: '0', banglaQrAmount: '0' }), {
    paidAmount: 0, cashAmount: 0, banglaQrAmount: 0
  });
});

test('missing and blank initial payment are rejected', () => {
  assert.throws(() => normalizeInitialPayment({}), /initial payment amount is required/i);
  assert.throws(() => normalizeInitialPayment({ paidAmount: '' }), /initial payment amount is required/i);
});

test('mixed initial payment must equal cash plus Bangla QR', () => {
  assert.deepEqual(normalizeInitialPayment({ paidAmount: '125.50', cashAmount: '100', banglaQrAmount: '25.50' }), {
    paidAmount: 125.5, cashAmount: 100, banglaQrAmount: 25.5
  });
  assert.throws(() => normalizeInitialPayment({ paidAmount: 125, cashAmount: 100, banglaQrAmount: 20 }), /must exactly equal/i);
});
