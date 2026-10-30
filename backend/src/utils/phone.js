export function normalizePhone(value) {
  let phone = String(value || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('0088')) phone = phone.slice(2);
  if (phone.startsWith('88') && phone.length === 13) phone = phone.slice(2);
  return phone;
}
