import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import SalesReturn from '../models/SalesReturn.js';
import Batch from '../models/Batch.js';
import Inventory from '../models/Inventory.js';
import StockMovement from '../models/StockMovement.js';
import MoneyReceipt from '../models/MoneyReceipt.js';
import { actorOf, audit } from '../utils/audit.js';

const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const makeReturnNo = () => `RET-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

function bad(message, status = 400) { return Object.assign(new Error(message), { status }); }

export async function listSalesReturns(req, res, next) {
  try {
    const filter = { branchId: req.branchId };
    if (req.query.invoiceId && mongoose.isValidObjectId(req.query.invoiceId)) filter.invoiceId = req.query.invoiceId;
    if (req.query.customerId && mongoose.isValidObjectId(req.query.customerId)) filter.customerId = req.query.customerId;
    const rows = await SalesReturn.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function getSalesReturn(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid return ID.' });
    const row = await SalesReturn.findOne({ _id: req.params.id, branchId: req.branchId }).populate('invoiceId', 'invoiceNo invoiceDate');
    if (!row) return res.status(404).json({ message: 'Sales return not found.' });
    res.json(row);
  } catch (error) { next(error); }
}

export async function createSalesReturn(req, res, next) {
  const changedBatches = [];
  const changedInventories = [];
  let savedReturn = null;
  let savedMovements = [];
  try {
    const { invoiceId, items: requestedItems, settlementType, refundMethod = '', cashRefundAmount = 0, banglaQrRefundAmount = 0, note = '' } = req.body;
    if (!mongoose.isValidObjectId(invoiceId)) throw bad('Select a valid original invoice.');
    if (!['customer_credit', 'due_adjustment', 'cash_refund'].includes(settlementType)) throw bad('Select a valid return settlement option.');
    if (!Array.isArray(requestedItems) || !requestedItems.length) throw bad('Select at least one item to return.');

    const invoice = await Invoice.findOne({ _id: invoiceId, branchId: req.branchId });
    if (!invoice) throw bad('Original invoice was not found in the selected branch.', 404);
    if (!invoice.customerId) throw bad('This invoice has no customer account. A return cannot be financially settled.', 400);

    const previousReturns = await SalesReturn.find({ invoiceId: invoice._id, branchId: req.branchId });
    const returnedByLine = new Map();
    const returnedByBatchLine = new Map();
    for (const prior of previousReturns) for (const priorItem of prior.items) {
      const lineKey = String(priorItem.invoiceItemIndex);
      returnedByLine.set(lineKey, round((returnedByLine.get(lineKey) || 0) + priorItem.quantity));
      for (const allocation of priorItem.allocations || []) {
        const key = `${lineKey}:${String(allocation.batchId)}`;
        returnedByBatchLine.set(key, round((returnedByBatchLine.get(key) || 0) + allocation.quantity));
      }
    }

    const processedLineIndexes = new Set();
    const items = [];
    let totalRefund = 0;
    for (const raw of requestedItems) {
      const index = Number(raw.invoiceItemIndex);
      if (!Number.isInteger(index) || index < 0 || index >= invoice.items.length) throw bad('A selected invoice item is invalid.');
      if (processedLineIndexes.has(index)) throw bad('Do not submit the same invoice line more than once.');
      processedLineIndexes.add(index);
      const original = invoice.items[index];
      const quantity = Number(raw.quantity);
      const refundUnitPrice = Number(raw.refundUnitPrice);
      if (!Number.isFinite(quantity) || quantity <= 0) throw bad(`Enter a valid return quantity for ${original.name}.`);
      if (!Number.isFinite(refundUnitPrice) || refundUnitPrice < 0) throw bad(`Enter a valid manual refund price for ${original.name}.`);
      const previouslyReturned = returnedByLine.get(String(index)) || 0;
      const remaining = round(original.quantity - previouslyReturned);
      if (quantity > remaining + 0.000001) throw bad(`Only ${remaining} unit(s) of ${original.name} remain eligible for return.`);
      const allocations = [];
      let allocationRemaining = quantity;
      for (const originalAllocation of original.batchAllocations || []) {
        const batchId = String(originalAllocation.batchId);
        const priorQty = returnedByBatchLine.get(`${index}:${batchId}`) || 0;
        const availableFromBatch = Math.max(0, round(originalAllocation.quantity - priorQty));
        if (!availableFromBatch) continue;
        const take = Math.min(availableFromBatch, allocationRemaining);
        if (take > 0) {
          allocations.push({ batchId: originalAllocation.batchId, batchNo: originalAllocation.batchNo, quantity: take });
          allocationRemaining = round(allocationRemaining - take);
        }
        if (allocationRemaining <= 0) break;
      }
      if (allocationRemaining > 0.000001) throw bad(`The original batch allocation for ${original.name} is incomplete. This item cannot be returned safely.`);
      const lineRefundTotal = round(quantity * refundUnitPrice);
      if (lineRefundTotal <= 0) throw bad(`Refund value for ${original.name} must be greater than zero.`);
      totalRefund = round(totalRefund + lineRefundTotal);
      items.push({ invoiceItemIndex: index, productId: original.product, name: original.name, sku: original.sku, quantity, refundUnitPrice, lineRefundTotal, allocations });
    }
    if (totalRefund <= 0) throw bad('Return total must be greater than zero.');

    const cash = round(cashRefundAmount || 0);
    const qr = round(banglaQrRefundAmount || 0);
    if (settlementType === 'cash_refund') {
      if (!['cash', 'bangla_qr', 'mixed'].includes(refundMethod)) throw bad('Select a cash refund method.');
      if (cash < 0 || qr < 0 || round(cash + qr) !== totalRefund) throw bad('Cash plus Bangla QR refund must exactly equal the return total.');
      if (refundMethod === 'cash' && (cash !== totalRefund || qr !== 0)) throw bad('Cash refund amounts do not match the selected method.');
      if (refundMethod === 'bangla_qr' && (qr !== totalRefund || cash !== 0)) throw bad('Bangla QR refund amounts do not match the selected method.');
      if (refundMethod === 'mixed' && (cash <= 0 || qr <= 0)) throw bad('Enter positive cash and Bangla QR amounts for a mixed refund.');
    } else if (cash !== 0 || qr !== 0 || refundMethod) {
      throw bad('A payment method is only required for cash refunds.');
    }

    if (settlementType === 'due_adjustment') {
      const [branchInvoices, receipts, dueReturns] = await Promise.all([
        Invoice.find({ customerId: invoice.customerId, branchId: req.branchId }).select('dueAmount'),
        MoneyReceipt.find({ customerId: invoice.customerId, branchId: req.branchId }).select('amount'),
        SalesReturn.find({ customerId: invoice.customerId, branchId: req.branchId, settlementType: 'due_adjustment' }).select('totalRefund')
      ]);
      const outstanding = round(branchInvoices.reduce((sum, row) => sum + Number(row.dueAmount || 0), 0) - receipts.reduce((sum, row) => sum + Number(row.amount || 0), 0) - dueReturns.reduce((sum, row) => sum + Number(row.totalRefund || 0), 0));
      if (totalRefund > Math.max(0, outstanding) + 0.000001) throw bad(`Due adjustment cannot exceed the customer's current branch grand due (${Math.max(0, outstanding).toFixed(2)}). Choose customer credit or cash refund if the return value is higher.`);
    }

    // Persist the return record first; if a stock update fails, compensating cleanup below removes it.
    savedReturn = await SalesReturn.create({
      returnNo: makeReturnNo(), invoiceId: invoice._id, invoiceNo: invoice.invoiceNo,
      customerId: invoice.customerId,
      customerSnapshot: { customerNo: '', name: invoice.customerName, phone: invoice.customerPhone },
      branchId: req.branchId, items, totalRefund, settlementType,
      refundMethod: settlementType === 'cash_refund' ? refundMethod : '',
      cashRefundAmount: settlementType === 'cash_refund' ? cash : 0,
      banglaQrRefundAmount: settlementType === 'cash_refund' ? qr : 0,
      note: String(note || '').trim(), processedBy: actorOf(req.user)
    });

    for (const item of items) {
      const inventory = await Inventory.findOne({ branchId: req.branchId, productId: item.productId });
      if (!inventory) throw bad(`Branch inventory record is missing for ${item.name}. Cannot complete this return safely.`, 409);
      const inventoryBefore = inventory.quantity;
      const inventoryAfter = round(inventoryBefore + item.quantity);
      inventory.quantity = inventoryAfter;
      inventory.updatedBy = actorOf(req.user);
      await inventory.save();
      changedInventories.push({ id: inventory._id, before: inventoryBefore });

      for (const allocation of item.allocations) {
        const batch = await Batch.findOneAndUpdate(
          { _id: allocation.batchId, branchId: req.branchId, productId: item.productId, active: true },
          { $inc: { quantity: allocation.quantity } },
          { new: true }
        );
        if (!batch) throw bad(`Original batch ${allocation.batchNo} is unavailable. Return was not completed.`, 409);
        changedBatches.push({ id: batch._id, quantity: allocation.quantity });
        const movement = await StockMovement.create({
          branchId: req.branchId, productId: item.productId, batchId: batch._id, batchNo: batch.batchNo,
          type: 'return', quantity: allocation.quantity,
          beforeQuantity: round(batch.quantity - allocation.quantity), afterQuantity: batch.quantity,
          unitCost: null, referenceType: 'SalesReturn', referenceId: savedReturn._id,
          note: `Return ${savedReturn.returnNo} against ${invoice.invoiceNo}`,
          actor: actorOf(req.user)
        });
        savedMovements.push(movement._id);
      }
    }

    await audit(req, 'sales_return.create', 'SalesReturn', savedReturn._id, {
      returnNo: savedReturn.returnNo, invoiceNo: invoice.invoiceNo, customerId: invoice.customerId,
      totalRefund, settlementType, refundMethod: savedReturn.refundMethod, itemCount: items.length
    });
    res.status(201).json(savedReturn);
  } catch (error) {
    if (savedReturn) {
      if (savedMovements.length) await StockMovement.deleteMany({ _id: { $in: savedMovements } }).catch(() => {});
      for (const changed of [...changedBatches].reverse()) await Batch.updateOne({ _id: changed.id }, { $inc: { quantity: -changed.quantity } }).catch(() => {});
      for (const changed of [...changedInventories].reverse()) await Inventory.updateOne({ _id: changed.id }, { $set: { quantity: changed.before } }).catch(() => {});
      await SalesReturn.deleteOne({ _id: savedReturn._id }).catch(() => {});
    }
    next(error);
  }
}
