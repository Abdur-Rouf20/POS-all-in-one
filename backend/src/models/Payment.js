import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  invoiceNo: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  customerName: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['cash', 'bangla_qr'], required: true },
  note: { type: String, default: '' },
  receivedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  }
}, { timestamps: true });

export default mongoose.model('Payment', schema);
