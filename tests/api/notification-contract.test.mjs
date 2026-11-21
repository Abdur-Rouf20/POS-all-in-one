import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate } from '../../backend/src/services/notifications/templates.js';
import { normalizeWhatsAppPhone } from '../../backend/src/services/notifications/channels/whatsappProvider.js';

test('Bangladesh local mobile number is normalized to country-code form for WhatsApp', () => {
  assert.equal(normalizeWhatsAppPhone('01712345678'), '8801712345678');
});
test('already international Bangladesh phone is preserved', () => {
  assert.equal(normalizeWhatsAppPhone('+8801712345678'), '8801712345678');
});
test('international access prefix is normalized', () => { assert.equal(normalizeWhatsAppPhone('008801712345678'), '8801712345678'); });
test('invalid short phone is rejected', () => {
  assert.throws(() => normalizeWhatsAppPhone('1234'), /valid country code/i);
});
test('English invoice template contains total, paid and due', () => {
  const body = renderTemplate('invoice.created', 'en', { customerName: 'Test', number: 'INV-1', total: 100, paid: 40, due: 60 });
  assert.match(body, /INV-1/); assert.match(body, /100\.00/); assert.match(body, /40\.00/); assert.match(body, /60\.00/);
});
test('Bengali account statement includes grand due and no separate credit balance', () => {
  const body = renderTemplate('customer.account_summary', 'bn', { customerName: 'রহিম', invoiceOutstanding: 500, moneyReceipts: 100, dueAdjustments: 50, cashRefunds: 10, grandDue: 350 });
  assert.match(body, /সর্বমোট বকেয়া/); assert.match(body, /350\.00/); assert.doesNotMatch(body, /ক্রেডিট/);
});
test('sales return template reports settlement type accurately', () => {
  const body = renderTemplate('sales_return.created', 'en', { customerName: 'Test', number: 'RET-1', invoiceNo: 'INV-2', total: 20, settlementLabel: 'Cash refund' });
  assert.match(body, /Cash refund/);
});
