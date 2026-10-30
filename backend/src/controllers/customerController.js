import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import MoneyReceipt from '../models/MoneyReceipt.js';
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
    const [invoices, receipts] = await Promise.all([
      Invoice.find({ customerId: customer._id, ...branchFilter }).sort({ createdAt: -1 }).limit(500),
      MoneyReceipt.find({ customerId: customer._id, ...branchFilter }).sort({ createdAt: -1 }).limit(500)
    ]);
    const invoiceDue = invoices.reduce((sum, invoice) => sum + Number(invoice.dueAmount || 0), 0);
    const receiptTotal = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
    const grandDue = Math.round((invoiceDue - receiptTotal) * 100) / 100;
    const transactions = [
      ...invoices.map(invoice => ({ type: 'invoice', id: invoice._id, number: invoice.invoiceNo, date: invoice.createdAt, amount: invoice.total, due: invoice.dueAmount, paidAtCreation: invoice.paidAmount })),
      ...receipts.map(receipt => ({ type: 'money_receipt', id: receipt._id, number: receipt.receiptNo, date: receipt.createdAt, amount: receipt.amount, cashAmount: receipt.cashAmount, banglaQrAmount: receipt.banglaQrAmount }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ customer, summary: { invoiceCount: invoices.length, invoiceTotal: invoices.reduce((s, x) => s + x.total, 0), invoiceOutstanding: invoiceDue, moneyReceipts: receiptTotal, grandDue }, transactions, invoices, receipts });
  } catch (error) { next(error); }
}
