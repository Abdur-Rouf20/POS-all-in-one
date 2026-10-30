import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

dotenv.config();

async function run() {
  await connectDB();
  const products = await Product.find({});
  let created = 0;
  let linked = 0;
  for (const product of products) {
    if (product.categoryId) continue;
    const name = String(product.category || 'General').trim() || 'General';
    let category = await Category.findOne({ normalizedName: name.toLocaleLowerCase() });
    if (!category) {
      category = await Category.create({ name, normalizedName: name.toLocaleLowerCase(), description: 'Migrated from existing product catalog' });
      created += 1;
    }
    product.categoryId = category._id;
    product.category = category.name;
    await product.save();
    linked += 1;
  }
  console.log(`Category migration complete. Created ${created} categories; linked ${linked} products.`);
  await mongoose.disconnect();
}

run().catch(async error => {
  console.error('Category migration failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
