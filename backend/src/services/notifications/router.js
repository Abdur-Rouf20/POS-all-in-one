import Customer from '../../models/Customer.js';
import { isOnWhatsApp, sendWhatsApp } from './channels/whatsappProvider.js';
import { sendSms } from './channels/smsProvider.js';

export async function deliverNotification(message) {
  const customer = await Customer.findById(message.customerId);
  if (!customer) throw new Error('Customer no longer exists.');
  if (customer.notificationConsent !== 'opted_in') return { status: 'skipped_opt_out', reason: 'CUSTOMER_NOT_OPTED_IN' };

  let channel = customer.notifyChannel || 'auto';
  if (channel === 'sms') return sendSms(message.recipient, message.body);

  if (channel === 'auto') {
    // A failed WAHA lookup is transient/unknown; retry later rather than guessing.
    const exists = await isOnWhatsApp(message.recipient);
    channel = exists ? 'whatsapp' : 'sms';
    customer.notifyChannel = channel;
    await customer.save();
  }

  if (channel === 'sms') return sendSms(message.recipient, message.body);

  try {
    const result = await sendWhatsApp(message.recipient, message.body);
    return { status: 'sent', channel: 'whatsapp', response: result };
  } catch (sendError) {
    // Only switch preference to SMS when a fresh registration check confirms the number is no longer on WhatsApp.
    const stillRegistered = await isOnWhatsApp(message.recipient);
    if (stillRegistered) throw sendError;
    customer.notifyChannel = 'sms';
    await customer.save();
    return sendSms(message.recipient, message.body);
  }
}
