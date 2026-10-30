import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { audit } from '../utils/audit.js';

export async function listCategories(req, res, next) {
  try {
    const filter = req.query.includeInactive === 'true' && req.user.role === 'owner' ? {} : { active: true };
    res.json(await Category.find(filter).sort({ name: 1 }));
  } catch (error) { next(error); }
}

export async function createCategory(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name) return res.status(400).json({ message: 'Category name is required.' });
    const category = await Category.create({ name, normalizedName: name.toLocaleLowerCase(), description, createdBy: req.user._id });
    await audit(req, 'category.create', 'Category', category._id, { name });
    res.status(201).json(category);
  } catch (error) { next(error); }
}

export async function updateCategory(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid category ID.' });
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    if (updates.name === '') return res.status(400).json({ message: 'Category name cannot be empty.' });
    if (updates.name) updates.normalizedName = updates.name.toLocaleLowerCase();
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    await audit(req, 'category.update', 'Category', category._id, updates);
    res.json(category);
  } catch (error) { next(error); }
}

export async function deleteCategory(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid category ID.' });
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    const usedByProducts = await Product.exists({ categoryId: category._id });
    if (usedByProducts) return res.status(409).json({ message: 'This category is assigned to products. Deactivate it instead of deleting it.' });
    await category.deleteOne();
    await audit(req, 'category.delete', 'Category', category._id, { name: category.name });
    res.json({ message: 'Category deleted.' });
  } catch (error) { next(error); }
}
