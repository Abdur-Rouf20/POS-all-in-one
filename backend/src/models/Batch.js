import mongoose from 'mongoose';

const actorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  role: { type: String, required: true }
}, { _id: false });

const schema = new mongoose.Schema({
  batchNo: { type: String, required: true, unique: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  quantityReceived: { type: Number, required: true, min: 0.0001 },
  quantity: { type: Number, required: true, min: 0 },
  purchasePrice: { type: Number, default: null, min: 0, select: false },
  sellingPrice: { type: Number, required: true, min: 0 },
  costStatus: { type: String, enum: ['pending_owner', 'confirmed'], default: 'pending_owner', index: true },
  receivedAt: { type: Date, default: Date.now, index: true },
  receivedBy: { type: actorSchema, required: true },
  costUpdatedAt: { type: Date, default: null },
  costUpdatedBy: { type: actorSchema, default: null },
  note: { type: String, default: '' },
  legacy: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
}, { timestamps: true });

schema.index({ branchId:  1, productId: 1, receivedAt: 1 });
schema.index({ branchId: 1, productId: 1, quantity: 1 });
export default mongoose.model('Batch', schema);
