import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { audit } from '../utils/audit.js';

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listProducts(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const filter = !(req.user.role === 'owner' && req.query.includeInactive === 'true') ? { active: true } : {};
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: regex }, { sku: regex }, { barcode: regex }, { category: regex }];
    }
    const products = await Product.find(filter).populate('categoryId', 'name').sort({ createdAt: -1 });
    res.json(products);
  } catch (error) { next(error); }
}

export async function createProduct(req, res, next) {
  try {
    const { name, sku, barcode = '', categoryId, description = '', price, unit = 'pcs' } = req.body;
    const parsedPrice = Number(price);
    if (!String(name || '').trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: 'Product name and a valid non-negative selling price are required.' });
    }
    if (!categoryId || !mongoose.isValidObjectId(categoryId)) return res.status(400).json({ message: 'Select a valid product category.' });
    const category = await Category.findOne({ _id: categoryId, active: true });
    if (!category) return res.status(400).json({ message: 'Selected category is unavailable.' });
    const product = await Product.create({
      name: String(name).trim(), sku: String(sku || '').trim() || undefined,
      barcode: String(barcode).trim(), categoryId: category._id, category: category.name,
      description: String(description).trim(), price: parsedPrice, unit: String(unit || 'pcs').trim()
    });
    await audit(req, 'product.create', 'Product', product._id, { name: product.name, categoryId: category._id, sku: product.sku });
    res.status(201).json(await product.populate('categoryId', 'name'));
  } catch (error) { next(error); }
}

export async function updateProduct(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid product ID.' });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const { name, sku, barcode, categoryId, description, price, unit, active } = req.body;
    if (name !== undefined) product.name = String(name).trim();
    if (sku !== undefined) product.sku = String(sku).trim() || undefined;
    if (barcode !== undefined) product.barcode = String(barcode).trim();
    if (description !== undefined) product.description = String(description).trim();
    if (price !== undefined) {
      const parsed = Number(price);
      if (!Number.isFinite(parsed) || parsed < 0) return res.status(400).json({ message: 'Selling price must be a valid non-negative number.' });
      product.price = parsed;
    }
    if (unit !== undefined) product.unit = String(unit).trim();
    if (active !== undefined) product.active = Boolean(active);
    if (categoryId !== undefined) {
      if (!mongoose.isValidObjectId(categoryId)) return res.status(400).json({ message: 'Select a valid product category.' });
      const category = await Category.findOne({ _id: categoryId, active: true });
      if (!category) return res.status(400).json({ message: 'Selected category is unavailable.' });
      product.categoryId = category._id;
      product.category = category.name;
    }
    await product.save();
    await audit(req, 'product.update', 'Product', product._id, { name: product.name, categoryId: product.categoryId, price: product.price });
    res.json(await product.populate('categoryId', 'name'));
  } catch (error) { next(error); }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    // Soft-delete so historical invoices and stock movements keep their product reference.
    product.active = false;
    await product.save();
    await audit(req, 'product.deactivate', 'Product', product._id, { name: product.name });
    res.json({ message: 'Product deactivated.' });
  } catch (error) { next(error); }
}
