import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  customerNo: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  normalizedPhone: { type: String, required: true, unique: true, trim: true, index: true },
  address: { type: String, default: '', trim: true },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  lastPurchaseAt: { type: Date, default: null }
}, { timestamps: true });

schema.index({ name: 'text', phone: 'text', customerNo: 'text' });
export default mongoose.model('Customer', schema);
