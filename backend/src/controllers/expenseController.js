import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import { actorOf, audit } from '../utils/audit.js';

const round = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : NaN;
};

function expenseNo() {
  return `EXP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function validateBody(body) {
  const category = String(body.category || '').trim();
  const description = String(body.description || '').trim();
  const amount = round(body.amount);
  const cashAmount = round(body.cashAmount ?? 0);
  const banglaQrAmount = round(body.banglaQrAmount ?? 0);
  const expenseDate = body.expenseDate ? new Date(body.expenseDate) : new Date();
  const paymentMethod = body.paymentMethod;

  if (!category) return { error: 'Expense category is required.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid expense amount.' };
  if (!['cash', 'bangla_qr', 'mixed'].includes(paymentMethod)) return { error: 'Select a valid payment method.' };
  if (!Number.isFinite(cashAmount) || !Number.isFinite(banglaQrAmount) || cashAmount < 0 || banglaQrAmount < 0) return { error: 'Payment amounts cannot be negative.' };
  if (round(cashAmount + banglaQrAmount) !== amount) return { error: 'Cash plus Bangla QR must equal the expense amount.' };
  if (paymentMethod === 'cash' && (cashAmount !== amount || banglaQrAmount !== 0)) return { error: 'Cash payment amounts do not match the selected method.' };
  if (paymentMethod === 'bangla_qr' && (banglaQrAmount !== amount || cashAmount !== 0)) return { error: 'Bangla QR payment amounts do not match the selected method.' };
  if (paymentMethod === 'mixed' && !(cashAmount > 0 && banglaQrAmount > 0)) return { error: 'For mixed payment, enter both cash and Bangla QR amounts.' };
  if (Number.isNaN(expenseDate.getTime())) return { error: 'Enter a valid expense date.' };
  return { value: { category, description, amount, cashAmount, banglaQrAmount, expenseDate, paymentMethod } };
}

function ownerOnly(req, res) {
  if (req.user?.role !== 'owner') {
    res.status(403).json({ message: 'Only the Owner can access expense management.' });
    return false;
  }
  return true;
}

export async function listExpenses(req, res, next) {
  try {
    if (!ownerOnly(req, res)) return;
    const filter = { branchId: req.branchId };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.from || req.query.to) {
      filter.expenseDate = {};
      if (req.query.from) filter.expenseDate.$gte = new Date(`${req.query.from}T00:00:00.000`);
      if (req.query.to) filter.expenseDate.$lte = new Date(`${req.query.to}T23:59:59.999`);
    }
    const rows = await Expense.find(filter).sort({ expenseDate: -1, createdAt: -1 }).limit(1000);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const cashTotal = rows.reduce((sum, row) => sum + row.cashAmount, 0);
    const qrTotal = rows.reduce((sum, row) => sum + row.banglaQrAmount, 0);
    const byCategory = {};
    for (const row of rows) byCategory[row.category] = round((byCategory[row.category] || 0) + row.amount);
    res.json({ rows, summary: { total: round(total), cashTotal: round(cashTotal), banglaQrTotal: round(qrTotal), count: rows.length, byCategory } });
  } catch (error) { next(error); }
}

export async function createExpense(req, res, next) {
  try {
    if (!ownerOnly(req, res)) return;
    const parsed = validateBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const expense = await Expense.create({
      expenseNo: expenseNo(), branchId: req.branchId, ...parsed.value,
      createdBy: actorOf(req.user)
    });
    await audit(req, 'expense.create', 'Expense', expense._id, {
      expenseNo: expense.expenseNo, category: expense.category, amount: expense.amount,
      paymentMethod: expense.paymentMethod, expenseDate: expense.expenseDate
    });
    res.status(201).json(expense);
  } catch (error) { next(error); }
}

export async function updateExpense(req, res, next) {
  try {
    if (!ownerOnly(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid expense ID.' });
    const parsed = validateBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const expense = await Expense.findOne({ _id: req.params.id, branchId: req.branchId });
    if (!expense) return res.status(404).json({ message: 'Expense not found in the selected branch.' });
    const before = {
      category: expense.category, description: expense.description, amount: expense.amount,
      paymentMethod: expense.paymentMethod, cashAmount: expense.cashAmount,
      banglaQrAmount: expense.banglaQrAmount, expenseDate: expense.expenseDate
    };
    Object.assign(expense, parsed.value, { updatedBy: actorOf(req.user) });
    await expense.save();
    await audit(req, 'expense.update', 'Expense', expense._id, { expenseNo: expense.expenseNo, before, after: parsed.value });
    res.json(expense);
  } catch (error) { next(error); }
}

export async function deleteExpense(req, res, next) {
  try {
    if (!ownerOnly(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid expense ID.' });
    const expense = await Expense.findOne({ _id: req.params.id, branchId: req.branchId });
    if (!expense) return res.status(404).json({ message: 'Expense not found in the selected branch.' });
    await audit(req, 'expense.delete', 'Expense', expense._id, {
      expenseNo: expense.expenseNo, category: expense.category, amount: expense.amount,
      paymentMethod: expense.paymentMethod, expenseDate: expense.expenseDate
    });
    await expense.deleteOne();
    res.json({ message: `Expense ${expense.expenseNo} deleted.` });
  } catch (error) { next(error); }
}
