import Invoice from '../models/Invoice.js';
import SalesReturn from '../models/SalesReturn.js';
import MoneyReceipt from '../models/MoneyReceipt.js';
import Expense from '../models/Expense.js';
import Inventory from '../models/Inventory.js';
import Batch from '../models/Batch.js';

const round = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const validDate = value => value && !Number.isNaN(new Date(value).getTime());

function dateRange(query) {
  const from = validDate(query.from) ? new Date(query.from) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = validDate(query.to) ? new Date(query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  if (from > to) {
    const error = new Error('Start date cannot be after end date.');
    error.status = 400;
    throw error;
  }
  return { from, to };
}

export async function getReport(req, res, next) {
  try {
    const owner = req.user.role === 'owner';
    const type = String(req.query.type || 'sales').toLowerCase();
    const allowed = ['sales', 'returns', 'receipts', 'expenses', 'inventory'];
    if (!allowed.includes(type)) return res.status(400).json({ message: 'Unsupported report type.' });
    if (type === 'expenses' && !owner) return res.status(403).json({ message: 'Owner access is required for expense reports.' });

    const { from, to } = dateRange(req.query);
    const branchFilter = req.branchId ? { branchId: req.branchId } : {};
    const dateField = {
      sales: 'invoiceDate',
      returns: 'returnDate',
      receipts: 'receiptDate',
      expenses: 'expenseDate'
    }[type];
    let rows = [];
    let totals = {};

    if (type === 'sales') {
      const docs = await Invoice.find({
        ...branchFilter,
        invoiceDate: { $gte: from, $lte: to }
      }).populate('branchId', 'name code').sort({ invoiceDate: -1 }).lean();

      rows = docs.map(invoice => {
        const quantity = (invoice.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        let knownCost = 0;
        let knownCostQuantity = 0;
        for (const item of invoice.items || []) {
          for (const allocation of item.batchAllocations || []) {
            if (allocation.costStatus === 'confirmed' && allocation.unitCost != null) {
              knownCost += Number(allocation.quantity || 0) * Number(allocation.unitCost || 0);
              knownCostQuantity += Number(allocation.quantity || 0);
            }
          }
        }
        const row = {
          date: invoice.invoiceDate,
          invoiceNo: invoice.invoiceNo,
          branch: invoice.branchId?.name || '—',
          customer: invoice.customerName || 'Walk-in customer',
          itemCount: (invoice.items || []).length,
          quantity: round(quantity),
          total: round(invoice.total),
          paid: round(invoice.paidAmount),
          due: round(invoice.dueAmount),
          paymentStatus: invoice.paymentStatus || invoice.status || '—'
        };
        if (owner) {
          row.knownCost = round(knownCost);
          row.knownGrossProfit = round(invoice.total - knownCost);
          row.costCoverage = `${round(knownCostQuantity)} / ${round(quantity)}`;
        }
        return row;
      });
      totals = {
        invoiceCount: docs.length,
        quantity: round(rows.reduce((sum, row) => sum + row.quantity, 0)),
        sales: round(rows.reduce((sum, row) => sum + row.total, 0)),
        paid: round(rows.reduce((sum, row) => sum + row.paid, 0)),
        due: round(rows.reduce((sum, row) => sum + row.due, 0))
      };
      if (owner) {
        totals.knownCost = round(rows.reduce((sum, row) => sum + row.knownCost, 0));
        totals.knownGrossProfit = round(rows.reduce((sum, row) => sum + row.knownGrossProfit, 0));
        totals.note = 'Known gross profit is before returns and excludes unconfirmed historical batch costs.';
      }
    } else if (type === 'returns') {
      const docs = await SalesReturn.find({
        ...branchFilter,
        returnDate: { $gte: from, $lte: to }
      }).populate('branchId', 'name code').sort({ returnDate: -1 }).lean();
      rows = docs.map(doc => ({
        date: doc.returnDate,
        returnNo: doc.returnNo,
        invoiceNo: doc.invoiceNo,
        branch: doc.branchId?.name || '—',
        customer: doc.customerSnapshot?.name || '—',
        quantity: round((doc.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
        refund: round(doc.totalRefund),
        settlement: doc.settlementType,
        refundMethod: doc.refundMethod || '—',
        processedBy: doc.processedBy?.name || '—'
      }));
      totals = { returnCount: docs.length, refund: round(rows.reduce((sum, row) => sum + row.refund, 0)) };
    } else if (type === 'receipts') {
      const docs = await MoneyReceipt.find({
        ...branchFilter,
        receiptDate: { $gte: from, $lte: to }
      }).populate('branchId', 'name code').sort({ receiptDate: -1 }).lean();
      rows = docs.map(doc => ({
        date: doc.receiptDate,
        receiptNo: doc.receiptNo,
        branch: doc.branchId?.name || '—',
        customer: doc.customerSnapshot?.name || '—',
        phone: doc.customerSnapshot?.phone || '—',
        amount: round(doc.amount),
        cash: round(doc.cashAmount),
        banglaQr: round(doc.banglaQrAmount),
        paymentType: doc.paymentType,
        receivedBy: doc.receivedBy?.name || '—'
      }));
      totals = {
        receiptCount: docs.length,
        amount: round(rows.reduce((sum, row) => sum + row.amount, 0)),
        cash: round(rows.reduce((sum, row) => sum + row.cash, 0)),
        banglaQr: round(rows.reduce((sum, row) => sum + row.banglaQr, 0))
      };
    } else if (type === 'expenses') {
      const docs = await Expense.find({
        ...branchFilter,
        expenseDate: { $gte: from, $lte: to }
      }).populate('branchId', 'name code').sort({ expenseDate: -1 }).lean();
      rows = docs.map(doc => ({
        date: doc.expenseDate,
        expenseNo: doc.expenseNo,
        branch: doc.branchId?.name || '—',
        category: doc.category,
        description: doc.description || '—',
        amount: round(doc.amount),
        cash: round(doc.cashAmount),
        banglaQr: round(doc.banglaQrAmount),
        paymentMethod: doc.paymentMethod,
        createdBy: doc.createdBy?.name || '—'
      }));
      const byCategory = {};
      for (const row of rows) byCategory[row.category] = round((byCategory[row.category] || 0) + row.amount);
      totals = {
        expenseCount: docs.length,
        amount: round(rows.reduce((sum, row) => sum + row.amount, 0)),
        cash: round(rows.reduce((sum, row) => sum + row.cash, 0)),
        banglaQr: round(rows.reduce((sum, row) => sum + row.banglaQr, 0)),
        byCategory
      };
    } else if (type === 'inventory') {
      const [inventoryDocs, batches] = await Promise.all([
        Inventory.find(branchFilter).populate('productId', 'name sku unit').populate('branchId', 'name code').lean(),
        Batch.find({ ...branchFilter, active: true }).select('+purchasePrice').populate('productId', 'name sku').populate('branchId', 'name code').lean()
      ]);
      const batchMap = new Map();
      for (const batch of batches) {
        const key = `${String(batch.branchId?._id || batch.branchId)}:${String(batch.productId?._id || batch.productId)}`;
        const value = batchMap.get(key) || { count: 0, costValue: 0, retailValue: 0, knownCostQty: 0, unknownCostQty: 0 };
        value.count += 1;
        value.retailValue += Number(batch.quantity || 0) * Number(batch.sellingPrice || 0);
        if (owner && batch.costStatus === 'confirmed' && batch.purchasePrice != null) {
          value.costValue += Number(batch.quantity || 0) * Number(batch.purchasePrice || 0);
          value.knownCostQty += Number(batch.quantity || 0);
        } else if (owner) {
          value.unknownCostQty += Number(batch.quantity || 0);
        }
        batchMap.set(key, value);
      }
      rows = inventoryDocs.map(doc => {
        const key = `${String(doc.branchId?._id || doc.branchId)}:${String(doc.productId?._id || doc.productId)}`;
        const batch = batchMap.get(key) || { count: 0, costValue: 0, retailValue: 0, knownCostQty: 0, unknownCostQty: 0 };
        const row = {
          branch: doc.branchId?.name || '—',
          product: doc.productId?.name || 'Unknown product',
          sku: doc.productId?.sku || '—',
          quantity: round(doc.quantity),
          batchCount: batch.count
        };
        if (owner) {
          row.confirmedCostValue = round(batch.costValue);
          row.retailValue = round(batch.retailValue);
          row.knownCostQuantity = round(batch.knownCostQty);
          row.unknownCostQuantity = round(batch.unknownCostQty);
        }
        return row;
      }).sort((a, b) => a.product.localeCompare(b.product));
      totals = {
        productCount: rows.length,
        stockQuantity: round(rows.reduce((sum, row) => sum + row.quantity, 0))
      };
      if (owner) {
        totals.confirmedCostValue = round(rows.reduce((sum, row) => sum + row.confirmedCostValue, 0));
        totals.retailValue = round(rows.reduce((sum, row) => sum + row.retailValue, 0));
        totals.unknownCostQuantity = round(rows.reduce((sum, row) => sum + row.unknownCostQuantity, 0));
        totals.note = 'Inventory cost includes only batches with confirmed purchase costs.';
      }
    }

    res.json({
      type,
      range: { from, to },
      generatedAt: new Date(),
      branchScope: req.branchId ? 'selected' : 'all',
      role: req.user.role,
      totals,
      rows
    });
  } catch (error) {
    next(error);
  }
}
