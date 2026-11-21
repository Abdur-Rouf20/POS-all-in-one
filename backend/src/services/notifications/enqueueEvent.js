import Customer from '../../models/Customer.js';
import Settings from '../../models/Settings.js';
import { enqueueNotification } from './queue.js';
import { renderTemplate } from './templates.js';

const preferenceForEvent = {
  'invoice.created': 'invoiceCreated',
  'sales_return.created': 'salesReturnCreated',
  'money_receipt.created': 'moneyReceiptCreated'
};

export async function enqueueBusinessNotification({ eventType, source, customerId, branchId, data, requestedBy = null }) {
  const customer = await Customer.findById(customerId);
  if (!customer || !customer.phone) return null;
  const settings = await Settings.findOne({ key: 'store' });
  const toggle = preferenceForEvent[eventType];
  if (toggle && settings?.notifications?.[toggle] === false) return null;
  const language = customer.preferredLanguage || 'en';
  const body = renderTemplate(eventType, language, {
    customerName: customer.name,
    businessName: settings?.businessName,
    ...data
  });
  return enqueueNotification({
    eventKey: `${eventType}:${String(source._id)}`,
    customerId: customer._id,
    customerName: customer.name,
    recipient: customer.phone,
    branchId: branchId || source.branchId || null,
    eventType,
    sourceId: source._id,
    templateKey: eventType,
    language,
    body,
    channelPreference: customer.notifyChannel || 'auto',
    requestedBy
  });
}
