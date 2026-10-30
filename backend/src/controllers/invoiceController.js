import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import StockMovement from '../models/StockMovement.js';
import Payment from '../models/Payment.js';
import { actorOf, audit } from '../utils/audit.js';
import { normalizePhone } from '../utils/phone.js';

function round(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function makeInvoiceNo() { return `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function makeCustomerNo() { return `CUS-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`; }

async function resolveCustomer(body, user) {
  const name = String(body.customerName || '').trim();
  const phone = String(body.customerPhone || '').trim();
  const normalizedPhone = normalizePhone(phone);
  if (!name || normalizedPhone.length < 10) {
    throw Object.assign(new Error('Customer name and a valid phone number are required.'), { status: 400 });
  }
  let customer = await Customer.findOne({ normalizedPhone });
  if (!customer) {
    try {
      customer = await Customer.create({
        customerNo: makeCustomerNo(), name, phone, normalizedPhone,
        address: String(body.customerAddress || '').trim(), createdBy: actorOf(user)
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      customer = await Customer.findOne({ normalizedPhone });
    }
  } else {
    let changed = false;
    if (body.customerName && customer.name !== name) { customer.name = name; changed = true; }
    if (body.customerAddress !== undefined && customer.address !== String(body.customerAddress).trim()) { customer.address = String(body.customerAddress).trim(); changed = true; }
    if (changed) await customer.save();
  }
  return customer;
}

async function normalize(body, branchId, user, old = null) {
  if (!Array.isArray(body.items) || !body.items.length) throw Object.assign(new Error('Add at least one item.'), { status: 400 });
  const customer = await resolveCustomer(body, user);
  const items = [];
  for (const raw of body.items) {
    const productId = raw.product || raw.productId;
    if (!mongoose.isValidObjectId(productId)) throw Object.assign(new Error('Select a valid product from inventory for every line.'), { status: 400 });
    const product = await Product.findById(productId);
    if (!product || !product.active) throw Object.assign(new Error('A selected product is unavailable.'), { status: 400 });
    const quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw Object.assign(new Error('Quantity must be positive.'), { status: 400 });
    const unitPrice = raw.unitPrice === undefined ? product.price : Number(raw.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error('Invalid product price.'), { status: 400 });
    items.push({ product: product._id, name: product.name, sku: product.sku || '', quantity, unitPrice, lineTotal: round(quantity * unitPrice) });
  }
  const subtotal = round(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = round(Math.max(0, Number(body.discount) || 0));
  if (discount > subtotal) throw Object.assign(new Error('Discount cannot exceed subtotal.'), { status: 400 });
  const taxRate = Math.max(0, Number(body.taxRate) || 0);
  const taxAmount = round((subtotal - discount) * taxRate / 100);
  const total = round(subtotal - discount + taxAmount);
  const paidAmount = old ? old.paidAmount : round(Math.max(0, Number(body.paidAmount ?? total)));
  if (paidAmount > total) throw Object.assign(new Error('Initial payment cannot exceed invoice total.'), { status: 400 });
  const cashAmount = old ? old.cashAmount : round(Math.max(0, Number(body.cashAmount) || 0));
  const banglaQrAmount = old ? old.banglaQrAmount : round(Math.max(0, Number(body.banglaQrAmount) || 0));
  if (round(cashAmount + banglaQrAmount) !== paidAmount) throw Object.assign(new Error('Cash plus Bangla QR must exactly equal the initial payment amount.'), { status: 400 });
  const paymentType = paidAmount === 0 ? 'unpaid' : cashAmount > 0 && banglaQrAmount > 0 ? 'mixed' : cashAmount > 0 ? 'cash' : 'bangla_qr';
  return {
    branchId, createdBy: old?.createdBy || actorOf(user), customerId: customer._id,
    customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address,
    items, subtotal, discount, taxRate, taxAmount, total, paidAmount,
    cashAmount, banglaQrAmount, paymentType,
    dueAmount: round(total - paidAmount),
    paymentStatus: paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    notes: body.notes || '', status: paidAmount >= total ? 'paid' : 'unpaid',
    invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : old?.invoiceDate || new Date()
  };
}

export async function listInvoices(req, res, next) {
  try {
    const q = req.query.q?.trim();
    const filter = { branchId: req.branchId };
    if (q) filter.$or = [{ invoiceNo: new RegExp(esc(q), 'i') }, { customerName: new RegExp(esc(q), 'i') }, { customerPhone: new RegExp(esc(q), 'i') }];
    res.json(await Invoice.find(filter).sort({ createdAt: -1 }).limit(500));
  } catch (error) { next(error); }
}

export async function getInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, branchId: req.branchId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    res.json(invoice);
  } catch (error) { next(error); }
}

export async function createInvoice(req, res, next) {
  try {
    const data = await normalize(req.body, req.branchId, req.user);
    data.invoiceNo = makeInvoiceNo();
    const invoice = await Invoice.create(data);
    try {
      if (invoice.cashAmount > 0) await Payment.create({ branchId: req.branchId, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo, customerId: invoice.customerId, customerName: invoice.customerName, amount: invoice.cashAmount, method: 'cash', receivedBy: actorOf(req.user), note: 'Initial invoice payment' });
      if (invoice.banglaQrAmount > 0) await Payment.create({ branchId: req.branchId, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo, customerId: invoice.customerId, customerName: invoice.customerName, amount: invoice.banglaQrAmount, method: 'bangla_qr', receivedBy: actorOf(req.user), note: 'Initial invoice payment' });

      for (const item of invoice.items) {
        const inventory = await Inventory.findOne({ branchId: req.branchId, productId: item.product });
        if (!inventory || inventory.quantity < item.quantity) throw Object.assign(new Error(`Insufficient stock for ${item.name}.`), { status: 400 });
        const before = inventory.quantity;
        inventory.quantity = round(inventory.quantity - item.quantity);
        inventory.updatedBy = actorOf(req.user);
        await inventory.save();
        await StockMovement.create({ branchId: req.branchId, productId: item.product, type: 'sale', quantity: -item.quantity, beforeQuantity: before, afterQuantity: inventory.quantity, referenceType: 'Invoice', referenceId: invoice._id, actor: actorOf(req.user) });
      }
    } catch (error) {
      await Payment.deleteMany({ invoiceId: invoice._id });
      const movements = await StockMovement.find({ referenceType: 'Invoice', referenceId: invoice._id });
      for (const movement of movements) await Inventory.updateOne({ branchId: req.branchId, productId: movement.productId }, { $inc: { quantity: -movement.quantity } });
      await StockMovement.deleteMany({ referenceType: 'Invoice', referenceId: invoice._id });
      await Invoice.findByIdAndDelete(invoice._id);
      throw error;
    }
    await Customer.updateOne({ _id: invoice.customerId }, { $set: { lastPurchaseAt: new Date() } });
    await audit(req, 'invoice.create', 'Invoice', invoice._id, { invoiceNo: invoice.invoiceNo, customerId: invoice.customerId, total: invoice.total, paidAmount: invoice.paidAmount, dueAmount: invoice.dueAmount, cashAmount: invoice.cashAmount, banglaQrAmount: invoice.banglaQrAmount });
    res.status(201).json(invoice);
  } catch (error) { next(error); }
}

export async function updateInvoice(req, res, next) {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only the owner can edit invoices.' });
    const old = await Invoice.findOne({ _id: req.params.id, branchId: req.branchId });
    if (!old) return res.status(404).json({ message: 'Invoice not found.' });
    if (old.paidAmount > 0) return res.status(409).json({ message: 'This invoice has an initial payment. Invoice revision with stock and payment reconciliation will be enabled in the audited editing phase.' });
    const data = await normalize(req.body, req.branchId, req.user, old);
    const invoice = await Invoice.findByIdAndUpdate(old._id, data, { new: true, runValidators: true });
    await audit(req, 'invoice.update', 'Invoice', invoice._id, { invoiceNo: invoice.invoiceNo, previousTotal: old.total, updatedTotal: invoice.total, reason: req.body.editReason || '', updatedBy: actorOf(req.user) });
    res.json(invoice);
  } catch (error) { next(error); }
}
