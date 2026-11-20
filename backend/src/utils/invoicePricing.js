const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function validationError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function finiteNonNegative(value, fieldName, fallback = 0) {
  const parsed = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw validationError(`${fieldName} must be a valid non-negative number.`);
  }
  return parsed;
}

/**
 * Calculate invoice pricing on the server. The stored `discount` remains the
 * monetary discount amount for compatibility with existing invoices/reports.
 */
export function calculateInvoicePricing({
  subtotal: rawSubtotal,
  discountType = 'fixed',
  discountValue: rawDiscountValue = 0,
  taxRate: rawTaxRate = 0
}) {
  const subtotal = finiteNonNegative(rawSubtotal, 'Subtotal');
  if (!['fixed', 'percentage'].includes(discountType)) {
    throw validationError('Discount type must be fixed or percentage.');
  }

  const discountValue = finiteNonNegative(rawDiscountValue, 'Discount');
  const taxRate = finiteNonNegative(rawTaxRate, 'Tax rate');
  if (discountType === 'percentage' && discountValue > 100) {
    throw validationError('Percentage discount cannot exceed 100%.');
  }
  const discount = roundMoney(
    discountType === 'percentage' ? subtotal * discountValue / 100 : discountValue
  );
  if (discount > subtotal) {
    throw validationError('Discount cannot exceed subtotal.');
  }

  const taxableAmount = roundMoney(subtotal - discount);
  const taxAmount = roundMoney(taxableAmount * taxRate / 100);
  const total = roundMoney(taxableAmount + taxAmount);
  if (![discount, taxableAmount, taxAmount, total].every(Number.isFinite)) {
    throw validationError('Invoice pricing values are outside the supported numeric range.');
  }

  return { subtotal: roundMoney(subtotal), discountType, discountValue, discount, taxRate, taxAmount, total };
}

/**
 * Initial invoice payment must be explicitly provided. A numeric zero is valid;
 * an omitted/null/blank value is not. Cash + QR must match the entered amount.
 */
export function normalizeInitialPayment(body = {}) {
  if (!Object.prototype.hasOwnProperty.call(body, 'paidAmount') ||
      body.paidAmount === null ||
      String(body.paidAmount).trim() === '') {
    throw validationError('Initial payment amount is required. Enter an amount, including 0 for an unpaid invoice.');
  }

  const paidAmount = finiteNonNegative(body.paidAmount, 'Initial payment');
  const cashAmount = finiteNonNegative(body.cashAmount, 'Cash amount');
  const banglaQrAmount = finiteNonNegative(body.banglaQrAmount, 'Bangla QR amount');

  if (roundMoney(cashAmount + banglaQrAmount) !== roundMoney(paidAmount)) {
    throw validationError('Cash plus Bangla QR must exactly equal the initial payment amount.');
  }

  return { paidAmount: roundMoney(paidAmount), cashAmount: roundMoney(cashAmount), banglaQrAmount: roundMoney(banglaQrAmount) };
}

export { roundMoney };
