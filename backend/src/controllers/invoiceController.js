import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';
import Payment from '../models/Payment.js';
import { actorOf, audit } from '../utils/audit.js';
import { normalizePhone } from '../utils/phone.js';

function round(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function makeInvoiceNo() { return `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function makeCustomerNo() { return `CUS-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`; }
function safeInvoiceForUser(invoice, user) {
  const value = invoice.toObject ? invoice.toObject() : { ...invoice };
  if (user.role !== 'owner') {
    for (const item of value.items || []) for (const allocation of item.batchAllocations || []) delete allocation.unitCost;
  }
  return value;
}

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
  const reserved = new Map();
  for (const raw of body.items) {
    const productId = raw.product || raw.productId;
    if (!mongoose.isValidObjectId(productId)) throw Object.assign(new Error('Select a valid product from inventory for every line.'), { status: 400 });
    const product = await Product.findById(productId);
    if (!product || !product.active) throw Object.assign(new Error('A selected product is unavailable.'), { status: 400 });
    const quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw Object.assign(new Error('Quantity must be positive.'), { status: 400 });
    const unitPrice = raw.unitPrice === undefined ? product.price : Number(raw.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error('Invalid product price.'), { status: 400 });
    const batchFilter = { branchId, productId: product._id, active: true, quantity: { $gt: 0 } };
    let allocations = [];
    if (raw.batchId) {
      if (user.role !== 'owner') throw Object.assign(new Error('Only the owner can manually select a stock batch.'), { status: 403 });
      if (!mongoose.isValidObjectId(raw.batchId)) throw Object.assign(new Error('Invalid batch selection.'), { status: 400 });
      const batch = await Batch.findOne({ ...batchFilter, _id: raw.batchId }).select('+purchasePrice');
      const alreadyReserved = reserved.get(String(raw.batchId)) || 0;
      if (!batch || batch.quantity - alreadyReserved < quantity) throw Object.assign(new Error(`Insufficient quantity in the selected batch for ${product.name}.`), { status: 400 });
      allocations = [{ batch, quantity }];
      reserved.set(String(batch._id), alreadyReserved + quantity);
    } else {
      const batches = await Batch.find(batchFilter).select('+purchasePrice').sort({ receivedAt: 1, createdAt: 1 });
      let remaining = quantity;
      for (const batch of batches) {
        const alreadyReserved = reserved.get(String(batch._id)) || 0;
        const available = Math.max(0, batch.quantity - alreadyReserved);
        if (!available) continue;
        const take = Math.min(available, remaining);
        allocations.push({ batch, quantity: take });
        reserved.set(String(batch._id), alreadyReserved + take);
        remaining = round(remaining - take);
        if (remaining <= 0) break;
      }
      if (remaining > 0) throw Object.assign(new Error(`Insufficient batch stock for ${product.name}. Available stock is lower than requested.`), { status: 400 });
    }
    const batchAllocations = allocations.map(({ batch, quantity: allocated }) => ({
      batchId: batch._id, batchNo: batch.batchNo, quantity: allocated,
      unitCost: batch.costStatus === 'confirmed' ? batch.purchasePrice : null,
      costStatus: batch.costStatus, sellingPrice: batch.sellingPrice
    }));
    items.push({ product: product._id, name: product.name, sku: product.sku || '', quantity, unitPrice, lineTotal: round(quantity * unitPrice), batchAllocations });
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
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(invoices.map(invoice => safeInvoiceForUser(invoice, req.user)));
  } catch (error) { next(error); }
}

export async function getInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, branchId: req.branchId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    res.json(safeInvoiceForUser(invoice, req.user));
  } catch (error) { next(error); }
}

export async function createInvoice(req, res, next) {
  try {
    const data = await normalize(req.body, req.branchId, req.user);
    data.invoiceNo = makeInvoiceNo();
    const invoice = await Invoice.create(data);
    const consumedBatches = [];
    try {
      if (invoice.cashAmount > 0) await Payment.create({ branchId: req.branchId, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo, customerId: invoice.customerId, customerName: invoice.customerName, amount: invoice.cashAmount, method: 'cash', receivedBy: actorOf(req.user), note: 'Initial invoice payment' });
      if (invoice.banglaQrAmount > 0) await Payment.create({ branchId: req.branchId, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo, customerId: invoice.customerId, customerName: invoice.customerName, amount: invoice.banglaQrAmount, method: 'bangla_qr', receivedBy: actorOf(req.user), note: 'Initial invoice payment' });

      for (const item of invoice.items) {
        const inventory = await Inventory.findOne({ branchId: req.branchId, productId: item.product });
        if (!inventory || inventory.quantity < item.quantity) throw Object.assign(new Error(`Insufficient branch stock for ${item.name}.`), { status: 400 });
        for (const allocation of item.batchAllocations) {
          const batch = await Batch.findOneAndUpdate(
            { _id: allocation.batchId, branchId: req.branchId, productId: item.product, quantity: { $gte: allocation.quantity } },
            { $inc: { quantity: -allocation.quantity } }, { new: true }
          );
          if (!batch) throw Object.assign(new Error(`Batch ${allocation.batchNo} no longer has enough stock. Refresh inventory and try again.`), { status: 409 });
          consumedBatches.push({ batchId: batch._id, productId: item.product, quantity: allocation.quantity });
          await StockMovement.create({
            branchId: req.branchId, productId: item.product, batchId: batch._id, batchNo: batch.batchNo,
            type: 'sale', quantity: -allocation.quantity,
            beforeQuantity: round(batch.quantity + allocation.quantity), afterQuantity: batch.quantity,
            unitCost: allocation.unitCost, referenceType: 'Invoice', referenceId: invoice._id,
            actor: actorOf(req.user)
          });
        }
        const before = inventory.quantity;
        inventory.quantity = round(before - item.quantity);
        inventory.updatedBy = actorOf(req.user);
        await inventory.save();
      }
    } catch (error) {
      await Payment.deleteMany({ invoiceId: invoice._id });
      for (const consumed of consumedBatches) {
        await Batch.updateOne({ _id: consumed.batchId }, { $inc: { quantity: consumed.quantity } });
      }
      const affectedProducts = [...new Set(consumedBatches.map(item => String(item.productId)))];
      for (const productId of affectedProducts) {
        const totals = await Batch.aggregate([
          { $match: { branchId: new mongoose.Types.ObjectId(req.branchId), productId: new mongoose.Types.ObjectId(productId), active: true } },
          { $group: { _id: null, quantity: { $sum: '$quantity' } } }
        ]);
        await Inventory.updateOne({ branchId: req.branchId, productId }, { $set: { quantity: totals[0]?.quantity || 0 } });
      }
      await StockMovement.deleteMany({ referenceType: 'Invoice', referenceId: invoice._id });
      await Invoice.findByIdAndDelete(invoice._id);
      throw error;
    }
    await Customer.updateOne({ _id: invoice.customerId }, { $set: { lastPurchaseAt: new Date() } });
    await audit(req, 'invoice.create', 'Invoice', invoice._id, { invoiceNo: invoice.invoiceNo, customerId: invoice.customerId, total: invoice.total, paidAmount: invoice.paidAmount, dueAmount: invoice.dueAmount, cashAmount: invoice.cashAmount, banglaQrAmount: invoice.banglaQrAmount });
    res.status(201).json(safeInvoiceForUser(invoice, req.user));
  } catch (error) { next(error); }
}

export async function updateInvoice(req, res) {
  return res.status(409).json({
    message: 'Invoice editing is temporarily paused while batch-level stock is being introduced. Owner-controlled editing with stock reconciliation and revision history will be enabled in Phase 4.'
  });
}
