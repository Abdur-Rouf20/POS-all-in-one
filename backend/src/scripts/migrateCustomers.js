import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import { normalizePhone } from '../utils/phone.js';

dotenv.config();

function makeCustomerNo() {
  return `CUS-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

async function run() {
  await connectDB();
  const owner = await User.findOne({ role: 'owner' });
  if (!owner) throw new Error('No owner account found.');
  const invoices = await Invoice.find({ $or: [{ customerId: null }, { customerId: { $exists: false } }] });
  const permissionResult = await User.updateMany({ role: 'salesman' }, { $addToSet: { permissions: { $each: ['customer.view', 'customer.create'] } } });
  let linked = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    const normalizedPhone = normalizePhone(invoice.customerPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      skipped += 1;
      console.warn(`Skipped ${invoice.invoiceNo}: no valid customer phone number.`);
      continue;
    }
    let customer = await Customer.findOne({ normalizedPhone });
    if (!customer) {
      customer = await Customer.create({
        customerNo: makeCustomerNo(),
        name: invoice.customerName || 'Customer',
        phone: invoice.customerPhone,
        normalizedPhone,
        address: invoice.customerAddress || '',
        createdBy: invoice.createdBy?.userId ? invoice.createdBy : { userId: owner._id, name: owner.name, role: owner.role }
      });
    }
    invoice.customerId = customer._id;
    await invoice.save();
    linked += 1;
  }
  console.log(`Customer migration complete. Linked invoices: ${linked}. Skipped invoices: ${skipped}. Updated salesman permissions: ${permissionResult.modifiedCount}.`);
}

run().catch(error => { console.error('Customer migration failed:', error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
