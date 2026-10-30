import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customerSnapshot: {
    customerNo: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: '' }
  },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  cashAmount: { type: Number, default: 0, min: 0 },
  banglaQrAmount: { type: Number, default: 0, min: 0 },
  paymentType: { type: String, enum: ['cash', 'bangla_qr', 'mixed'], required: true },
  note: { type: String, default: '' },
  receivedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  receiptDate: { type: Date, default: Date.now }
}, { timestamps: true });

schema.index({ customerId: 1, createdAt: -1 });
schema.index({ branchId: 1, createdAt: -1 });
export default mongoose.model('MoneyReceipt', schema);
