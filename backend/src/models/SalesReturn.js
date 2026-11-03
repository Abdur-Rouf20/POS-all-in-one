import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  batchNo: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 0.0001 }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  invoiceItemIndex: { type: Number, required: true, min: 0 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  sku: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 0.0001 },
  refundUnitPrice: { type: Number, required: true, min: 0 },
  lineRefundTotal: { type: Number, required: true, min: 0 },
  allocations: { type: [allocationSchema], default: [] }
}, { _id: false });

const schema = new mongoose.Schema({
  returnNo: { type: String, required: true, unique: true, index: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  invoiceNo: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customerSnapshot: {
    customerNo: { type: String, default: '' },
    name: { type: String, required: true },
    phone: { type: String, default: '' }
  },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  items: { type: [itemSchema], required: true, validate: value => value.length > 0 },
  totalRefund: { type: Number, required: true, min: 0.01 },
  settlementType: { type: String, enum: ['customer_credit', 'due_adjustment', 'cash_refund'], required: true },
  refundMethod: { type: String, enum: ['cash', 'bangla_qr', 'mixed', ''], default: '' },
  cashRefundAmount: { type: Number, default: 0, min: 0 },
  banglaQrRefundAmount: { type: Number, default: 0, min: 0 },
  note: { type: String, default: '' },
  processedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  returnDate: { type: Date, default: Date.now }
}, { timestamps: true });

schema.index({ branchId: 1, invoiceId: 1, createdAt: -1 });
schema.index({ branchId: 1, customerId: 1, createdAt: -1 });
export default mongoose.model('SalesReturn', schema);
