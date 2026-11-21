import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import MoneyReceipt from '../models/MoneyReceipt.js';
import SalesReturn from '../models/SalesReturn.js';
import { actorOf, audit } from '../utils/audit.js';
import { normalizePhone } from '../utils/phone.js';

function customerNumber() {
  return `CUS-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export async function findCustomer(req, res, next) {
  try {
    const phone = normalizePhone(req.query.phone);
    if (!phone) return res.status(400).json({ message: 'Enter a customer phone number.' });
    const customer = await Customer.findOne({ normalizedPhone: phone, active: true });
    return res.json({ found: Boolean(customer), customer });
  } catch (error) { next(error); }
}

export async function createCustomer(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const normalizedPhone = normalizePhone(phone);
    if (!name || normalizedPhone.length < 10) {
      return res.status(400).json({ message: 'Customer name and a valid phone number are required.' });
    }
    const existing = await Customer.findOne({ normalizedPhone });
    if (existing) return res.status(200).json({ customer: existing, existing: true });
    const customer = await Customer.create({
      customerNo: customerNumber(), name, phone, normalizedPhone,
      address: String(req.body.address || '').trim(), createdBy: actorOf(req.user)
    });
    await audit(req, 'customer.create', 'Customer', customer._id, { customerNo: customer.customerNo, phone: customer.phone });
    res.status(201).json({ customer, existing: false });
  } catch (error) { next(error); }
}

export async function listCustomers(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const filter = q ? { $or: [
      { name: new RegExp(escapeRegex(q), 'i') },
      { phone: new RegExp(escapeRegex(q), 'i') },
      { customerNo: new RegExp(escapeRegex(q), 'i') }
    ] } : {};
    const rows = await Customer.find(filter).sort({ updatedAt: -1 }).limit(100);
    res.json(rows);
  } catch (error) { next(error); }
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export async function customerLedger(req, res, next) {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    const branchFilter = req.user.role === 'owner' ? {} : { branchId: req.user.branchId };
    const [invoices, receipts, returns] = await Promise.all([
      Invoice.find({ customerId: customer._id, ...branchFilter }).sort({ createdAt: -1 }).limit(500),
      MoneyReceipt.find({ customerId: customer._id, ...branchFilter }).sort({ createdAt: -1 }).limit(500),
      SalesReturn.find({ customerId: customer._id, ...branchFilter }).sort({ createdAt: -1 }).limit(500)
    ]);
    const invoiceDue = invoices.reduce((sum, invoice) => sum + Number(invoice.dueAmount || 0), 0);
    const receiptTotal = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
    const dueAdjustments = returns.filter(row => ['due_adjustment', 'customer_credit'].includes(row.settlementType)).reduce((sum, row) => sum + Number(row.totalRefund || 0), 0);
    const cashRefunds = returns.filter(row => row.settlementType === 'cash_refund').reduce((sum, row) => sum + Number(row.totalRefund || 0), 0);
    const grandDue = Math.round((invoiceDue - receiptTotal - dueAdjustments) * 100) / 100;
    const transactions = [
      ...invoices.map(invoice => ({ type: 'invoice', id: invoice._id, number: invoice.invoiceNo, date: invoice.createdAt, amount: invoice.total, due: invoice.dueAmount, paidAtCreation: invoice.paidAmount })),
      ...receipts.map(receipt => ({ type: 'money_receipt', id: receipt._id, number: receipt.receiptNo, date: receipt.createdAt, amount: receipt.amount, cashAmount: receipt.cashAmount, banglaQrAmount: receipt.banglaQrAmount })),
      ...returns.map(row => ({ type: 'sales_return', id: row._id, number: row.returnNo, date: row.createdAt, amount: row.totalRefund, settlementType: row.settlementType, invoiceNo: row.invoiceNo }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ customer, summary: { invoiceCount: invoices.length, invoiceTotal: invoices.reduce((s, x) => s + x.total, 0), invoiceOutstanding: invoiceDue, moneyReceipts: receiptTotal, dueAdjustments, cashRefunds, grandDue }, transactions, invoices, receipts, returns });
  } catch (error) { next(error); }
}


export async function updateCustomerNotificationPreferences(req, res, next) {
  try {
    const { notifyChannel, notificationConsent, preferredLanguage } = req.body;
    const update = {};
    if (notifyChannel !== undefined) {
      if (!['auto', 'whatsapp', 'sms'].includes(notifyChannel)) return res.status(400).json({ message: 'Invalid notification channel.' });
      update.notifyChannel = notifyChannel;
    }
    if (notificationConsent !== undefined) {
      if (!['unknown', 'opted_in', 'opted_out'].includes(notificationConsent)) return res.status(400).json({ message: 'Invalid notification consent.' });
      update.notificationConsent = notificationConsent;
      update.notificationConsentAt = new Date();
      update.notificationConsentSource = String(req.body.consentSource || 'POS').slice(0, 80);
    }
    if (preferredLanguage !== undefined) {
      if (!['en', 'bn'].includes(preferredLanguage)) return res.status(400).json({ message: 'Preferred language must be en or bn.' });
      update.preferredLanguage = preferredLanguage;
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    await audit(req, 'customer.notification_preferences.update', 'Customer', customer._id, update);
    res.json(customer);
  } catch (error) { next(error); }
}

export async function queueCustomerAccountSummary(req, res, next) {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    if (customer.notificationConsent !== 'opted_in') return res.status(400).json({ message: 'Customer must opt in before receiving account summaries.' });
    const branchFilter = req.user.role === 'owner' ? {} : { branchId: req.user.branchId };
    const [invoices, receipts, returns] = await Promise.all([
      Invoice.find({ customerId: customer._id, ...branchFilter }).select('dueAmount').limit(500),
      MoneyReceipt.find({ customerId: customer._id, ...branchFilter }).select('amount').limit(500),
      SalesReturn.find({ customerId: customer._id, ...branchFilter }).select('totalRefund settlementType').limit(500)
    ]);
    const invoiceOutstanding = invoices.reduce((sum, row) => sum + Number(row.dueAmount || 0), 0);
    const moneyReceipts = receipts.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const dueAdjustments = returns.filter(row => ['due_adjustment', 'customer_credit'].includes(row.settlementType)).reduce((sum, row) => sum + Number(row.totalRefund || 0), 0);
    const cashRefunds = returns.filter(row => row.settlementType === 'cash_refund').reduce((sum, row) => sum + Number(row.totalRefund || 0), 0);
    const grandDue = Math.round((invoiceOutstanding - moneyReceipts - dueAdjustments) * 100) / 100;
    const { enqueueNotification } = await import('../services/notifications/queue.js');
    const { renderTemplate } = await import('../services/notifications/templates.js');
    const Settings = (await import('../models/Settings.js')).default;
    const settings = await Settings.findOne({ key: 'store' });
    const language = customer.preferredLanguage || 'en';
    const body = renderTemplate('customer.account_summary', language, {
      customerName: customer.name, businessName: settings?.businessName,
      invoiceOutstanding, moneyReceipts, dueAdjustments, cashRefunds, grandDue
    });
    const requestId = String(req.body.requestId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
    const message = await enqueueNotification({
      eventKey: `customer.account_summary:${customer._id}:${requestId}`,
      customerId: customer._id, customerName: customer.name, recipient: customer.phone,
      branchId: req.user.role === 'owner' ? null : req.user.branchId,
      eventType: 'customer.account_summary', sourceId: customer._id,
      templateKey: 'customer.account_summary', language, body,
      channelPreference: customer.notifyChannel || 'auto',
      requestedBy: { userId: req.user._id, name: req.user.name, role: req.user.role }
    });
    res.status(202).json({ message: 'Account summary added to notification queue.', notification: message, statement: { invoiceOutstanding, moneyReceipts, dueAdjustments, cashRefunds, grandDue } });
  } catch (error) { next(error); }
}

export async function listCustomerNotifications(req, res, next) {
  try {
    const NotificationMessage = (await import('../models/NotificationMessage.js')).default;
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    const filter = { customerId: customer._id };
    if (req.user.role !== 'owner') filter.branchId = req.user.branchId;
    const rows = await NotificationMessage.find(filter).sort({ createdAt: -1 }).limit(100).select('-providerResponse');
    res.json(rows);
  } catch (error) { next(error); }
}
