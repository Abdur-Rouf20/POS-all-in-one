import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null, index: true },
  batchNo: { type: String, default: '' },
  type: { type: String, enum: ['receive', 'sale', 'adjustment', 'return', 'transfer_in', 'transfer_out'], required: true },
  quantity: { type: Number, required: true },
  beforeQuantity: { type: Number, required: true },
  afterQuantity: { type: Number, required: true },
  unitCost: { type: Number, default: null },
  referenceType: { type: String, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  note: { type: String, default: '' },
  actor: { userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, name: { type: String, required: true }, role: { type: String, required: true } }
}, { timestamps: true });
schema.index({ branchId: 1, productId: 1, createdAt: -1 });
export default mongoose.model('StockMovement', schema);
