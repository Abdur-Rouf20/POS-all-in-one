import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';
import Payment from '../models/Payment.js';
import InvoiceRevision from '../models/InvoiceRevision.js';
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

async function normalize(body, branchId, user, old = null, stockCredit = new Map()) {
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
    const creditedBatchIds = [...stockCredit.keys()].filter(id => mongoose.isValidObjectId(id));
    const batchFilter = { branchId, productId: product._id, active: true, $or: [{ quantity: { $gt: 0 } }, ...(creditedBatchIds.length ? [{ _id: { $in: creditedBatchIds } }] : [])] };
    let allocations = [];
    if (raw.batchId) {
      if (user.role !== 'owner') throw Object.assign(new Error('Only the owner can manually select a stock batch.'), { status: 403 });
      if (!mongoose.isValidObjectId(raw.batchId)) throw Object.assign(new Error('Invalid batch selection.'), { status: 400 });
      const batch = await Batch.findOne({ ...batchFilter, _id: raw.batchId }).select('+purchasePrice');
      const alreadyReserved = reserved.get(String(raw.batchId)) || 0;
      if (!batch || batch.quantity + (stockCredit.get(String(batch._id)) || 0) - alreadyReserved < quantity) throw Object.assign(new Error(`Insufficient quantity in the selected batch for ${product.name}.`), { status: 400 });
      allocations = [{ batch, quantity }];
      reserved.set(String(batch._id), alreadyReserved + quantity);
    } else {
      const batches = await Batch.find(batchFilter).select('+purchasePrice').sort({ receivedAt: 1, createdAt: 1 });
      let remaining = quantity;
      for (const batch of batches) {
        const alreadyReserved = reserved.get(String(batch._id)) || 0;
        const available = Math.max(0, batch.quantity + (stockCredit.get(String(batch._id)) || 0) - alreadyReserved);
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

function revisionSnapshot(invoice) {
  const value = invoice.toObject ? invoice.toObject() : invoice;
  return {
    invoiceNo: value.invoiceNo,
    customerId: value.customerId,
    customerName: value.customerName,
    customerPhone: value.customerPhone,
    customerAddress: value.customerAddress,
    items: (value.items || []).map(item => ({
      product: item.product, name: item.name, sku: item.sku,
      quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal,
      batchAllocations: (item.batchAllocations || []).map(allocation => ({
        batchId: allocation.batchId, batchNo: allocation.batchNo,
        quantity: allocation.quantity, unitCost: allocation.unitCost,
        costStatus: allocation.costStatus, sellingPrice: allocation.sellingPrice
      }))
    })),
    subtotal: value.subtotal, discount: value.discount, taxRate: value.taxRate,
    taxAmount: value.taxAmount, total: value.total, notes: value.notes,
    invoiceDate: value.invoiceDate
  };
}

function allocationTotals(items) {
  const totals = new Map();
  for (const item of items || []) {
    for (const allocation of item.batchAllocations || []) {
      const key = String(allocation.batchId);
      totals.set(key, (totals.get(key) || 0) + Number(allocation.quantity || 0));
    }
  }
  return totals;
}

async function refreshInventory(branchId, productIds, user) {
  for (const productId of productIds) {
    const totals = await Batch.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId), productId: new mongoose.Types.ObjectId(productId), active: true } },
      { $group: { _id: null, quantity: { $sum: '$quantity' } } }
    ]);
    await Inventory.updateOne(
      { branchId, productId },
      { $set: { quantity: round(totals[0]?.quantity || 0), updatedBy: actorOf(user) } },
      { upsert: true }
    );
  }
}

export async function updateInvoice(req, res, next) {
  const appliedBatchDeltas = [];
  const createdMovementIds = [];
  let originalInvoice = null;
  let savedInvoice = null;
  let createdRevision = null;
  let affectedProducts = new Set();
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only the owner can edit an invoice.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid invoice ID.' });
    const reason = String(req.body.revisionReason || '').trim();
    if (reason.length < 5) return res.status(400).json({ message: 'Enter an edit reason with at least 5 characters.' });

    const invoice = await Invoice.findOne({ _id: req.params.id, branchId: req.branchId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found in this branch.' });
    originalInvoice = invoice.toObject({ depopulate: true });
    const before = revisionSnapshot(invoice);
    const originalPaidAmount = invoice.paidAmount;
    const originalCashAmount = invoice.cashAmount;
    const originalQrAmount = invoice.banglaQrAmount;

    const oldAllocations = allocationTotals(invoice.items);
    for (const item of invoice.items) {
      const allocated = (item.batchAllocations || []).reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0);
      if (!item.batchAllocations?.length || Math.abs(allocated - Number(item.quantity)) > 0.0001) {
        return res.status(409).json({ message: `Invoice ${invoice.invoiceNo} has incomplete legacy batch allocation data. It cannot be edited safely; leave it unchanged.` });
      }
      affectedProducts.add(String(item.product));
    }
    const stockCredit = oldAllocations;
    const data = await normalize(req.body, req.branchId, req.user, invoice, stockCredit);
    if (data.total < originalPaidAmount) {
      return res.status(400).json({ message: `The revised total cannot be lower than the original initial payment (${originalPaidAmount.toFixed(2)}).` });
    }
    // The original collection is immutable. Editing only recalculates the remaining due.
    data.paidAmount = originalPaidAmount;
    data.cashAmount = originalCashAmount;
    data.banglaQrAmount = originalQrAmount;
    data.paymentType = invoice.paymentType;
    data.dueAmount = round(data.total - originalPaidAmount);
    data.paymentStatus = originalPaidAmount >= data.total ? 'paid' : originalPaidAmount > 0 ? 'partial' : 'unpaid';
    data.status = data.paymentStatus === 'paid' ? 'paid' : 'unpaid';

    const newAllocations = allocationTotals(data.items);
    const allBatchIds = new Set([...oldAllocations.keys(), ...newAllocations.keys()]);
    const batchDeltas = [];
    for (const batchId of allBatchIds) {
      const delta = round((newAllocations.get(batchId) || 0) - (oldAllocations.get(batchId) || 0));
      if (!delta) continue;
      const batch = await Batch.findOne({ _id: batchId, branchId: req.branchId });
      if (!batch) throw Object.assign(new Error('A stock batch used by this invoice no longer exists in this branch.'), { status: 409 });
      const productId = String(batch.productId);
      affectedProducts.add(productId);
      batchDeltas.push({ batchId, productId, batchNo: batch.batchNo, delta });
    }

    // Apply net quantity changes with guarded decrements. Existing sale movements remain
    // immutable; new adjustment movements record the correction made by this revision.
    for (const change of batchDeltas) {
      const filter = { _id: change.batchId, branchId: req.branchId };
      if (change.delta > 0) filter.quantity = { $gte: change.delta };
      const updated = await Batch.findOneAndUpdate(
        filter,
        { $inc: { quantity: -change.delta } },
        { new: true }
      );
      if (!updated) throw Object.assign(new Error(`Insufficient remaining stock in batch ${change.batchNo}. Refresh stock and try again.`), { status: 409 });
      appliedBatchDeltas.push(change);
      const movement = await StockMovement.create({
        branchId: req.branchId, productId: change.productId, batchId: change.batchId,
        batchNo: change.batchNo, type: 'adjustment', quantity: -change.delta,
        beforeQuantity: round(updated.quantity + change.delta), afterQuantity: updated.quantity,
        referenceType: 'Invoice', referenceId: invoice._id,
        note: `Invoice ${invoice.invoiceNo} revised: ${reason}`,
        actor: actorOf(req.user)
      });
      createdMovementIds.push(movement._id);
    }

    invoice.set(data);
    savedInvoice = await invoice.save();
    const latestRevision = await InvoiceRevision.findOne({ invoiceId: invoice._id }).sort({ revisionNo: -1 }).select('revisionNo');
    createdRevision = await InvoiceRevision.create({
      invoiceId: invoice._id, invoiceNo: invoice.invoiceNo, branchId: req.branchId,
      revisionNo: (latestRevision?.revisionNo || 0) + 1, reason,
      changedBy: actorOf(req.user), before, after: revisionSnapshot(savedInvoice)
    });
    await refreshInventory(req.branchId, affectedProducts, req.user);
    await audit(req, 'invoice.update', 'Invoice', invoice._id, {
      invoiceNo: invoice.invoiceNo, revisionId: createdRevision._id,
      revisionNo: createdRevision.revisionNo, reason,
      previousTotal: before.total, updatedTotal: savedInvoice.total,
      originalPaidAmount, dueAmount: savedInvoice.dueAmount
    });
    return res.json(safeInvoiceForUser(savedInvoice, req.user));
  } catch (error) {
    // Compensating rollback for this standalone MongoDB deployment. We deliberately
    // retain historical movements only after a successful revision; failed attempts
    // remove their new movements and restore the previous quantities/document.
    try {
      if (createdRevision) await InvoiceRevision.deleteOne({ _id: createdRevision._id });
      if (savedInvoice && originalInvoice) {
        await Invoice.replaceOne({ _id: originalInvoice._id, branchId: req.branchId }, originalInvoice, { overwrite: true });
      }
      if (createdMovementIds.length) await StockMovement.deleteMany({ _id: { $in: createdMovementIds } });
      for (const change of [...appliedBatchDeltas].reverse()) {
        await Batch.updateOne({ _id: change.batchId, branchId: req.branchId }, { $inc: { quantity: change.delta } });
      }
      if (affectedProducts.size) await refreshInventory(req.branchId, affectedProducts, req.user);
    } catch (rollbackError) {
      console.error('Invoice revision rollback failed:', rollbackError);
      return res.status(500).json({ message: 'Invoice edit failed and automatic stock rollback needs attention. Stop further sales for the affected products and contact the system administrator.' });
    }
    return next(error);
  }
}

export async function listInvoiceRevisions(req, res, next) {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only the owner can view invoice revision history.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid invoice ID.' });
    const invoice = await Invoice.findOne({ _id: req.params.id, branchId: req.branchId }).select('_id invoiceNo');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found in this branch.' });
    const revisions = await InvoiceRevision.find({ invoiceId: invoice._id, branchId: req.branchId })
      .sort({ revisionNo: -1 }).limit(100).lean();
    res.json(revisions);
  } catch (error) { next(error); }
}
