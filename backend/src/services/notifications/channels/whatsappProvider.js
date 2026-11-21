const baseUrl = () => String(process.env.WAHA_URL || 'http://localhost:3000').replace(/\/$/, '');
const session = () => process.env.WAHA_SESSION || 'default';
function headers() {
  return { 'Content-Type': 'application/json', ...(process.env.WAHA_API_KEY ? { 'X-Api-Key': process.env.WAHA_API_KEY } : {}) };
}
export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const normalized = digits.startsWith('00880') ? digits.slice(2) : digits;
  const international = normalized.startsWith('01') && normalized.length === 11 ? `88${normalized}` : normalized;
  if (international.length < 10 || international.length > 15) throw new Error('Customer phone must include a valid country code.');
  return international;
}
export async function isOnWhatsApp(phone) {
  const digits = normalizeWhatsAppPhone(phone);
  const url = `${baseUrl()}/api/contacts/check-exists?phone=${encodeURIComponent(digits)}&session=${encodeURIComponent(session())}`;
  const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(Number(process.env.WAHA_TIMEOUT_MS || 12000)) });
  if (!response.ok) throw new Error(`WAHA contact check failed (${response.status}).`);
  const data = await response.json();
  return Boolean(data.numberExists);
}
export async function sendWhatsApp(phone, text) {
  const chatId = `${normalizeWhatsAppPhone(phone)}@c.us`;
  const response = await fetch(`${baseUrl()}/api/sendText`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ session: session(), chatId, text }),
    signal: AbortSignal.timeout(Number(process.env.WAHA_TIMEOUT_MS || 15000))
  });
  if (!response.ok) throw new Error(`WAHA send failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return response.json();
}
