import mongoose from 'mongoose';

const actorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  role: { type: String, required: true }
}, { _id: false });

const schema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  invoiceNo: { type: String, required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  revisionNo: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
  changedBy: { type: actorSchema, required: true },
  changedAt: { type: Date, default: Date.now, required: true },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  after: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

schema.index({ invoiceId: 1, revisionNo: 1 }, { unique: true });
schema.index({ branchId: 1, invoiceId: 1, changedAt: -1 });
export default mongoose.model('InvoiceRevision', schema);
