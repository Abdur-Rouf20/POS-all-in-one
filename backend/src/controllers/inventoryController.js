import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';
import Invoice from '../models/Invoice.js';
import { actorOf, audit } from '../utils/audit.js';

const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const makeBatchNo = () => `B-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export async function listInventory(req, res, next) {
  try {
    const rows = await Inventory.find({ branchId: req.branchId }).populate('productId').sort({ updatedAt: -1 });
    const result = [];
    for (const row of rows) {
      if (!row.productId?.active) continue;
      const batches = await Batch.find({ branchId: req.branchId, productId: row.productId._id, active: true, quantity: { $gt: 0 } })
        .sort({ receivedAt: 1, createdAt: 1 }).select('batchNo quantity quantityReceived sellingPrice receivedAt costStatus legacy');
      const entry = { ...row.toObject(), batches };
      if (req.user.role === 'owner') {
        entry.batches = await Batch.find({ branchId: req.branchId, productId: row.productId._id, active: true, quantity: { $gt: 0 } })
          .sort({ receivedAt: 1, createdAt: 1 }).select('+purchasePrice batchNo quantity quantityReceived sellingPrice receivedAt costStatus legacy');
      }
      result.push(entry);
    }
    res.json(result);
  } catch (error) { next(error); }
}

export async function listBatches(req, res, next) {
  try {
    const filter = { branchId: req.branchId, active: true };
    if (req.query.productId) {
      if (!mongoose.isValidObjectId(req.query.productId)) return res.status(400).json({ message: 'Invalid product ID.' });
      filter.productId = req.query.productId;
    }
    let query = Batch.find(filter).populate('productId', 'name sku unit').sort({ receivedAt: 1, createdAt: 1 });
    if (req.user.role === 'owner') query = query.select('+purchasePrice');
    else query = query.select('-purchasePrice');
    res.json(await query);
  } catch (error) { next(error); }
}

export async function receiveStock(req, res, next) {
  try {
    const { productId, quantity, sellingPrice, purchasePrice, note = '', receivedAt } = req.body;
    const qty = Number(quantity);
    const sell = Number(sellingPrice);
    if (!mongoose.isValidObjectId(productId) || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ message: 'Select a valid product and enter a positive quantity.' });
    if (!Number.isFinite(sell) || sell < 0) return res.status(400).json({ message: 'Enter a valid batch selling price.' });
    const product = await Product.findOne({ _id: productId, active: true });
    if (!product) return res.status(404).json({ message: 'Product not found or inactive.' });

    const isOwner = req.user.role === 'owner';
    let cost = null;
    if (isOwner) {
      cost = Number(purchasePrice);
      if (!Number.isFinite(cost) || cost < 0) return res.status(400).json({ message: 'Owner must enter a valid buying price.' });
    }
    const when = receivedAt ? new Date(receivedAt) : new Date();
    if (Number.isNaN(when.getTime())) return res.status(400).json({ message: 'Invalid received date.' });
    const batch = await Batch.create({
      batchNo: makeBatchNo(), branchId: req.branchId, productId,
      quantityReceived: qty, quantity: qty, sellingPrice: sell,
      purchasePrice: cost, costStatus: isOwner ? 'confirmed' : 'pending_owner',
      receivedAt: when, receivedBy: actorOf(req.user), note: String(note).trim()
    });
    const key = { branchId: req.branchId, productId };
    let inventory = await Inventory.findOne(key);
    let createdInventory = false;
    let before = 0;
    try {
      if (!inventory) { inventory = await Inventory.create({ ...key, quantity: 0 }); createdInventory = true; }
      before = inventory.quantity;
      inventory.quantity = round(before + qty);
      inventory.updatedBy = actorOf(req.user);
      await inventory.save();
      const movement = await StockMovement.create({
        branchId: req.branchId, productId, batchId: batch._id, batchNo: batch.batchNo,
        type: 'receive', quantity: qty, beforeQuantity: before, afterQuantity: inventory.quantity,
        unitCost: cost, note: String(note).trim(), actor: actorOf(req.user)
      });
      await audit(req, 'inventory.batch.receive', 'Batch', batch._id, {
        batchNo: batch.batchNo, productId, quantity: qty, sellingPrice: sell,
        costStatus: batch.costStatus, purchasePrice: isOwner ? cost : undefined, movementId: movement._id
      });
      const responseBatch = isOwner ? await Batch.findById(batch._id).select('+purchasePrice').populate('productId', 'name sku') : await Batch.findById(batch._id).populate('productId', 'name sku');
      res.status(201).json({ batch: responseBatch, inventory, movement });
    } catch (error) {
      await StockMovement.deleteMany({ batchId: batch._id });
      await Batch.deleteOne({ _id: batch._id });
      if (createdInventory) await Inventory.deleteOne({ _id: inventory._id });
      else if (inventory) await Inventory.updateOne({ _id: inventory._id }, { $set: { quantity: before } });
      throw error;
    }
  } catch (error) { next(error); }
}

export async function updateBatchCost(req, res, next) {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only the owner can view or update buying prices.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid batch ID.' });
    const cost = Number(req.body.purchasePrice);
    if (!Number.isFinite(cost) || cost < 0) return res.status(400).json({ message: 'Enter a valid buying price.' });
    const batch = await Batch.findOne({ _id: req.params.id, branchId: req.branchId });
    if (!batch) return res.status(404).json({ message: 'Batch not found in this branch.' });
    const previousCost = batch.purchasePrice;
    batch.purchasePrice = cost;
    batch.costStatus = 'confirmed';
    batch.costUpdatedAt = new Date();
    batch.costUpdatedBy = actorOf(req.user);
    await batch.save();
    await StockMovement.updateMany({ batchId: batch._id, type: 'receive' }, { $set: { unitCost: cost } });
    await Invoice.updateMany(
      { 'items.batchAllocations.batchId': batch._id },
      { $set: { 'items.$[].batchAllocations.$[allocation].unitCost': cost, 'items.$[].batchAllocations.$[allocation].costStatus': 'confirmed' } },
      { arrayFilters: [{ 'allocation.batchId': batch._id }] }
    );
    await audit(req, 'inventory.batch.cost.update', 'Batch', batch._id, { batchNo: batch.batchNo, previousCost, purchasePrice: cost });
    res.json(await Batch.findById(batch._id).select('+purchasePrice').populate('productId', 'name sku'));
  } catch (error) { next(error); }
}

export async function listMovements(req, res, next) {
  try {
    let query = StockMovement.find({ branchId: req.branchId }).populate('productId', 'name sku').sort({ createdAt: -1 }).limit(500);
    if (req.user.role !== 'owner') query = query.select('-unitCost');
    const rows = await query;
    res.json(rows);
  } catch (error) { next(error); }
}
