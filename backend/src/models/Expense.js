import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  expenseNo: { type: String, required: true, unique: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['cash', 'bangla_qr', 'mixed'], required: true },
  cashAmount: { type: Number, default: 0, min: 0 },
  banglaQrAmount: { type: Number, default: 0, min: 0 },
  expenseDate: { type: Date, required: true },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  updatedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    role: String
  }
}, { timestamps: true });

schema.index({ branchId: 1, expenseDate: -1 });
schema.index({ branchId: 1, category: 1, expenseDate: -1 });
export default mongoose.model('Expense', schema);
