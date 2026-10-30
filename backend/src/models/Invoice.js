import mongoose from 'mongoose';
const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  sku: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  batchAllocations: [{
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    batchNo: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    unitCost: { type: Number, default: null },
    costStatus: { type: String, enum: ['pending_owner', 'confirmed'], default: 'pending_owner' },
    sellingPrice: { type: Number, required: true, min: 0 }
  }]
}, { _id: false });
const invoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  createdBy: { userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, name: { type: String, required: true }, role: { type: String, required: true } },
  paidAmount: { type: Number, default: 0, min: 0 },
  cashAmount: { type: Number, default: 0, min: 0 },
  banglaQrAmount: { type: Number, default: 0, min: 0 },
  paymentType: { type: String, enum: ['cash', 'bangla_qr', 'mixed', 'unpaid'], default: 'unpaid' },
  dueAmount: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['paid','partial','unpaid'], default: 'unpaid' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  items: { type: [itemSchema], validate: v => v.length > 0 },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0, min: 0 },
  taxRate: { type: Number, default: 0, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  invoiceDate: { type: Date, default: Date.now }
}, { timestamps: true });
invoiceSchema.index({branchId:1,invoiceNo:1},{unique:true});
invoiceSchema.index({branchId:1,invoiceNo:1},{unique:true});
export default mongoose.model('Invoice', invoiceSchema);
