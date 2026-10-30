import mongoose from 'mongoose';
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, trim: true, unique: true, sparse: true },
  category: { type: String, default: 'General', trim: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'pcs' },
  active: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('Product', productSchema);
