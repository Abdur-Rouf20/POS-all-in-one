import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import Batch from '../models/Batch.js';
import Product from '../models/Product.js';

dotenv.config();

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const inventories = await Inventory.find({ quantity: { $gt: 0 } });
  let created = 0;
  let skipped = 0;
  for (const inventory of inventories) {
    const existing = await Batch.findOne({ branchId: inventory.branchId, productId: inventory.productId, legacy: true });
    if (existing) { skipped++; continue; }
    const product = await Product.findById(inventory.productId);
    if (!product) { skipped++; continue; }
    const batchNo = `LEGACY-${String(inventory._id).slice(-8).toUpperCase()}`;
    await Batch.create({
      batchNo, branchId: inventory.branchId, productId: inventory.productId,
      quantityReceived: inventory.quantity, quantity: inventory.quantity,
      purchasePrice: null, sellingPrice: Number(product.price || 0),
      costStatus: 'pending_owner', receivedAt: inventory.updatedAt || new Date(),
      receivedBy: { userId: inventory.updatedBy?.userId || null, name: inventory.updatedBy?.name || 'System migration', role: 'system' },
      note: 'Migrated from legacy branch inventory. Owner must enter buying cost.', legacy: true
    });
    created++;
  }
  console.log(`Batch migration complete. Created ${created} legacy batches; skipped ${skipped} records.`);
  console.log('Legacy batches have no buying cost. Owner must review and enter the correct cost before relying on profit reports.');
}

run().catch(error => { console.error('Batch migration failed:', error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
