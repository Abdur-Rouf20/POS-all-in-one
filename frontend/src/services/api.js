import { translations } from '../i18n.js';

const API = import.meta.env.VITE_API_URL || '/api';
const invoiceErrorKeys = {
  'Initial payment amount is required. Enter an amount, including 0 for an unpaid invoice.': 'initialPaymentRequired',
  'Initial payment cannot exceed invoice total.': 'paymentExceedsTotal',
  'Initial payment must be a valid non-negative number.': 'invalidInitialPayment',
  'Discount cannot exceed subtotal.': 'invalidDiscount',
  'Discount must be a valid non-negative number.': 'invalidDiscount',
  'Discount type must be fixed or percentage.': 'invalidDiscount',
  'Percentage discount cannot exceed 100%.': 'invalidDiscount',
  'Tax rate must be a valid non-negative number.': 'invalidTax',
  'Cash plus Bangla QR must exactly equal the initial payment amount.': 'paymentSplitMismatch',
  'Customer name and a valid phone number are required.': 'customerNamePhoneRequired',
  'Add at least one item.': 'noItems',
  'Enter an edit reason with at least 5 characters.': 'editReasonRequired',
  'Only the owner can edit an invoice.': 'ownerOnlyInvoiceEdit'
};

function localizedError(message, fallback) {
  const language = localStorage.getItem('pos-language');
  const stockError = /^(?:Insufficient batch stock for (.+)\. Available stock is lower than requested\.|Insufficient quantity in the selected batch for (.+)\.|Insufficient branch stock for (.+)\.)$/.exec(message || '');
  const productName = stockError?.slice(1).find(Boolean);
  if (productName) {
    const error = new Error(language === 'bn'
      ? translations.bn.stockUnavailableItem.replace('{name}', productName)
      : message);
    error.code = 'INSUFFICIENT_STOCK';
    error.productName = productName;
    return error;
  }
  const error = new Error(language === 'bn'
    ? translations.bn[invoiceErrorKeys[message]] || fallback
    : message || fallback);
  return error;
}

async function request(path, options = {}) {
  const token = localStorage.getItem('pos-token');
  const branchId = localStorage.getItem('pos-branch');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(branchId ? { 'X-Branch-Id': branchId } : {}),
    ...(options.headers || {})
  };
  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch (error) {
    if (error instanceof TypeError && localStorage.getItem('pos-language') === 'bn') {
      throw new Error(translations.bn.networkError);
    }
    throw error;
  }
  const data = await response.json().catch(() => ({ message: 'Unexpected server response' }));
  if (!response.ok) {
    const fallback = response.status >= 500 ? translations[localStorage.getItem('pos-language')]?.serverError || `Request failed (${response.status})` : translations[localStorage.getItem('pos-language')]?.errorGeneric || `Request failed (${response.status})`;
    throw localizedError(data.message, fallback);
  }
  return data;
}

export const api = {
  login: body => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  branches: () => request('/branches'),
  createBranch: body => request('/branches', { method: 'POST', body: JSON.stringify(body) }),
  updateBranch: (id, body) => request(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  users: () => request('/auth/users'),
  createSalesman: body => request('/auth/users/salesman', { method: 'POST', body: JSON.stringify(body) }),

  findCustomer: phone => request(`/customers/lookup?phone=${encodeURIComponent(phone)}`),
  customers: (q = '') => request(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createCustomer: body => request('/customers', { method: 'POST', body: JSON.stringify(body) }),
  customerLedger: id => request(`/customers/${id}/ledger`),

  moneyReceipts: (customerId = '') => request(`/money-receipts${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''}`),
  createMoneyReceipt: body => request('/money-receipts', { method: 'POST', body: JSON.stringify(body) }),
  moneyReceipt: id => request(`/money-receipts/${id}`),
  salesReturns: (invoiceId = '') => request(`/returns${invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : ''}`),
  createSalesReturn: body => request('/returns', { method: 'POST', body: JSON.stringify(body) }),
  salesReturn: id => request(`/returns/${id}`),
  expenses: (filters = {}) => { const params = new URLSearchParams(); if (filters.category) params.set('category', filters.category); if (filters.from) params.set('from', filters.from); if (filters.to) params.set('to', filters.to); const query = params.toString(); return request(`/expenses${query ? `?${query}` : ''}`); },
  createExpense: body => request('/expenses', { method: 'POST', body: JSON.stringify(body) }),
  updateExpense: (id, body) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteExpense: id => request(`/expenses/${id}`, { method: 'DELETE' }),

  report: (type, filters = {}) => { const p = new URLSearchParams({ type }); if(filters.from)p.set('from',filters.from); if(filters.to)p.set('to',filters.to); if(filters.allBranches)p.set('allBranches','true'); const q=p.toString(); return request(`/reports?${q}`,filters.allBranches?{headers:{'X-Branch-Id':''}}:{}); },
  dashboard: (filters = {}) => { const p = new URLSearchParams(); if(filters.from)p.set('from',filters.from); if(filters.to)p.set('to',filters.to); if(filters.allBranches)p.set('allBranches','true'); const q=p.toString(); return request(`/dashboard/summary${q?'?'+q:''}`,filters.allBranches?{headers:{'X-Branch-Id':''}}:{}); },
  categories: (includeInactive = false) => request(`/categories${includeInactive ? '?includeInactive=true' : ''}`),
  createCategory: body => request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id, body) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: id => request(`/categories/${id}`, { method: 'DELETE' }),
  products: (q = '', includeInactive = false) => { const params = new URLSearchParams(); if (q) params.set('q', q); if (includeInactive) params.set('includeInactive', 'true'); const query = params.toString(); return request(`/products${query ? `?${query}` : ''}`); },
  createProduct: body => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: id => request(`/products/${id}`, { method: 'DELETE' }),
  inventory: (q = '') => request(`/inventory${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  batches: (productId = '') => request(`/inventory/batches${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`),
  receiveStock: body => request('/inventory/receive', { method: 'POST', body: JSON.stringify(body) }),
  updateBatchCost: (id, purchasePrice) => request(`/inventory/batches/${id}/cost`, { method: 'PATCH', body: JSON.stringify({ purchasePrice }) }),
  stockMovements: () => request('/inventory/movements'),
  invoices: (q = '') => request(`/invoices${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  invoice: id => request(`/invoices/${id}`),
  createInvoice: body => request('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  updateInvoice: (id, body) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  invoiceRevisions: id => request(`/invoices/${id}/revisions`),
  payments: id => request(`/payments/invoices/${id}`),
  settings: () => request('/settings'),
  updateSettings: body => request('/settings', { method: 'PUT', body: JSON.stringify(body) })
};
