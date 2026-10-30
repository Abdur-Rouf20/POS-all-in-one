import mongoose from 'mongoose';
const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'store', unique: true },
  businessName: { type: String, default: 'My POS Store' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  currency: { type: String, default: '৳' },
  taxRate: { type: Number, default: 0, min: 0 },
  invoiceFooter: { type: String, default: 'Thank you for your business!' }
}, { timestamps: true });
export default mongoose.model('Settings', settingsSchema);
