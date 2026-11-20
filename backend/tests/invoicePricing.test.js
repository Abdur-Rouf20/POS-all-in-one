import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoicePricing, normalizeInitialPayment } from '../src/utils/invoicePricing.js';

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

test('legacy fixed discount defaults remain compatible', () => {
  const result = calculateInvoicePricing({ subtotal: 100, discountType: 'fixed', discountValue: 15, taxRate: 0 });
  assert.equal(result.discount, 15);
  assert.equal(result.total, 85);
});

test('fixed discount cannot exceed subtotal', () => {
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, discountType: 'fixed', discountValue: 101 }), /cannot exceed subtotal/i);
});

test('percentage discount cannot exceed 100 while tax remains a non-negative rate', () => {
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, discountType: 'percentage', discountValue: 101 }), /cannot exceed 100/i);
  const pricing = calculateInvoicePricing({ subtotal: 100, taxRate: 125 });
  assert.equal(pricing.taxAmount, 125);
  assert.equal(pricing.total, 225);
  assert.throws(() => calculateInvoicePricing({ subtotal: 100, taxRate: -0.01 }), /non-negative/i);
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
