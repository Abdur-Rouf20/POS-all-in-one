import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customerName: { type: String, default: '' },
  recipient: { type: String, required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  eventType: { type: String, enum: ['invoice.created', 'sales_return.created', 'money_receipt.created', 'customer.account_summary'], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  templateKey: { type: String, required: true },
  language: { type: String, enum: ['en', 'bn'], default: 'en' },
  body: { type: String, required: true },
  channelPreference: { type: String, enum: ['auto', 'whatsapp', 'sms'], default: 'auto' },
  channel: { type: String, enum: ['whatsapp', 'sms', null], default: null },
  status: { type: String, enum: ['queued', 'processing', 'accepted', 'sent', 'delivered', 'failed', 'waiting_for_gateway', 'skipped_opt_out', 'skipped_sms_disabled'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lockedAt: { type: Date, default: null },
  lockToken: { type: String, default: '' },
  lastError: { type: String, default: '' },
  providerMessageId: { type: String, default: '' },
  requestedBy: { userId: mongoose.Schema.Types.ObjectId, name: String, role: String },
  providerResponse: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
schema.index({ customerId: 1, createdAt: -1 });
export default mongoose.model('NotificationMessage', schema);
