import mongoose from 'mongoose';
export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pos_mvp';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
}
