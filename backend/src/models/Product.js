import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  barcode: { type: String, trim: true, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
  // Kept temporarily for compatibility with existing invoices and inventory screens.
  category: { type: String, default: 'General', trim: true },
  description: { type: String, trim: true, default: '' },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'pcs', trim: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

productSchema.index({ name: 1 });
export default mongoose.model('Product', productSchema);
