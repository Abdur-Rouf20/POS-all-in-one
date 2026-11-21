export async function sendSms(phone, message) {
  if (process.env.SMS_ENABLED !== 'true') {
    return { status: 'skipped', channel: 'sms', reason: 'SMS_DISABLED' };
  }
  const endpoint = process.env.SMS_GATEWAY_URL;
  if (!endpoint) throw new Error('SMS_ENABLED is true but SMS_GATEWAY_URL is not configured.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.SMS_GATEWAY_TOKEN ? { Authorization: `Bearer ${process.env.SMS_GATEWAY_TOKEN}` } : {}) },
    body: JSON.stringify({ to: phone, message }),
    signal: AbortSignal.timeout(Number(process.env.SMS_TIMEOUT_MS || 15000))
  });
  if (!response.ok) throw new Error(`SMS gateway failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return { status: 'sent', channel: 'sms', response: await response.json().catch(() => ({})) };
}
