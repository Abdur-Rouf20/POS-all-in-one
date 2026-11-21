import crypto from 'node:crypto';
import NotificationMessage from '../../models/NotificationMessage.js';
import { deliverNotification } from './router.js';

const MIN_DELAY = Math.max(1000, Number(process.env.NOTIFICATION_MIN_DELAY_MS || 6000));
const MAX_DELAY = Math.max(MIN_DELAY, Number(process.env.NOTIFICATION_MAX_DELAY_MS || 12000));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5));
let workerStarted = false;
let workerBusy = false;

export async function enqueueNotification(payload) {
  try {
    return await NotificationMessage.create({ ...payload, status: 'queued', nextAttemptAt: new Date() });
  } catch (error) {
    if (error.code === 11000) return NotificationMessage.findOne({ eventKey: payload.eventKey });
    throw error;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const delay = () => Math.floor(MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY + 1));

export async function processNextNotification() {
  if (workerBusy) return false;
  workerBusy = true;
  const lockToken = crypto.randomUUID();
  try {
    const now = new Date();
    await NotificationMessage.updateMany({ status: 'processing', lockedAt: { $lt: new Date(Date.now() - 120000) } }, { $set: { status: 'queued', lockedAt: null, lockToken: '', nextAttemptAt: now } });
    const job = await NotificationMessage.findOneAndUpdate(
      { status: { $in: ['queued', 'failed'] }, nextAttemptAt: { $lte: now }, attempts: { $lt: MAX_ATTEMPTS } },
      { $set: { status: 'processing', lockedAt: now, lockToken }, $inc: { attempts: 1 } },
      { new: true, sort: { createdAt: 1 } }
    );
    if (!job) return false;
    try {
      const result = await deliverNotification(job);
      if (result.status === 'skipped') {
        job.status = 'skipped_sms_disabled';
      } else if (result.status === 'skipped_opt_out') {
        job.status = 'skipped_opt_out';
      } else {
        job.status = result.channel === 'whatsapp' ? 'accepted' : 'sent';
        job.channel = result.channel || 'sms';
        job.providerResponse = result.response || null;
      }
      job.lastError = '';
      await job.save();
    } catch (error) {
      job.lastError = String(error.message || error).slice(0, 1000);
      if (job.attempts >= MAX_ATTEMPTS) job.status = 'failed';
      else {
        job.status = 'queued';
        job.nextAttemptAt = new Date(Date.now() + Math.min(60 * 60 * 1000, 15000 * (2 ** (job.attempts - 1))));
      }
      await job.save();
    }
    return true;
  } finally {
    workerBusy = false;
  }
}

export function startNotificationWorker() {
  if (workerStarted || process.env.NOTIFICATIONS_WORKER_ENABLED !== 'true') return;
  workerStarted = true;
  (async function loop() {
    while (workerStarted) {
      const processed = await processNextNotification().catch(error => {
        console.error('[notifications] worker error:', error.message);
        return false;
      });
      if (processed) await sleep(delay());
      else await sleep(2000);
    }
  })();
}
