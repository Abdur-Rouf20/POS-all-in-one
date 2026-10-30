import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import MoneyReceipt from '../models/MoneyReceipt.js';
import Invoice from '../models/Invoice.js';
import { actorOf, audit } from '../utils/audit.js';

function makeReceiptNo() {
  return `MR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function createMoneyReceipt(req, res, next) {
  try {
    const { customerId, amount, cashAmount = 0, banglaQrAmount = 0, note = '' } = req.body;
    if (!mongoose.isValidObjectId(customerId)) return res.status(400).json({ message: 'Select a valid customer.' });
    const customer = await Customer.findById(customerId);
    if (!customer || !customer.active) return res.status(404).json({ message: 'Customer not found or inactive.' });
    const total = round(amount);
    const cash = round(cashAmount);
    const qr = round(banglaQrAmount);
    if (!Number.isFinite(total) || total <= 0 || cash < 0 || qr < 0 || round(cash + qr) !== total) {
      return res.status(400).json({ message: 'Cash plus Bangla QR must exactly equal the receipt amount.' });
    }
    const receipt = await MoneyReceipt.create({
      receiptNo: makeReceiptNo(), customerId,
      customerSnapshot: { customerNo: customer.customerNo, name: customer.name, phone: customer.phone, address: customer.address },
      branchId: req.branchId, amount: total, cashAmount: cash, banglaQrAmount: qr,
      paymentType: cash > 0 && qr > 0 ? 'mixed' : cash > 0 ? 'cash' : 'bangla_qr',
      note, receivedBy: actorOf(req.user)
    });
    await audit(req, 'money_receipt.create', 'MoneyReceipt', receipt._id, { receiptNo: receipt.receiptNo, customerId, amount: total, cashAmount: cash, banglaQrAmount: qr });
    res.status(201).json(receipt);
  } catch (error) { next(error); }
}

export async function listMoneyReceipts(req, res, next) {
  try {
    const filter = { branchId: req.branchId };
    if (req.query.customerId && mongoose.isValidObjectId(req.query.customerId)) filter.customerId = req.query.customerId;
    res.json(await MoneyReceipt.find(filter).sort({ createdAt: -1 }).limit(500));
  } catch (error) { next(error); }
}

export async function getMoneyReceipt(req, res, next) {
  try {
    const receipt = await MoneyReceipt.findOne({ _id: req.params.id, branchId: req.branchId }).populate('branchId', 'name code');
    if (!receipt) return res.status(404).json({ message: 'Money receipt not found.' });
    res.json(receipt);
  } catch (error) { next(error); }
}

function round(value) { const n = Number(value); return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : NaN; }
