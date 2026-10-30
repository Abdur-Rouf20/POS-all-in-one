const API = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('pos-token');
  const branchId = localStorage.getItem('pos-branch');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(branchId ? { 'X-Branch-Id': branchId } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({ message: 'Unexpected server response' }));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
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

  dashboard: () => request('/dashboard/summary'),
  categories: (includeInactive = false) => request(`/categories${includeInactive ? '?includeInactive=true' : ''}`),
  createCategory: body => request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id, body) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: id => request(`/categories/${id}`, { method: 'DELETE' }),
  products: (q = '', includeInactive = false) => { const params = new URLSearchParams(); if (q) params.set('q', q); if (includeInactive) params.set('includeInactive', 'true'); const query = params.toString(); return request(`/products${query ? `?${query}` : ''}`); },
  createProduct: body => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: id => request(`/products/${id}`, { method: 'DELETE' }),
  inventory: () => request('/inventory'),
  batches: (productId = '') => request(`/inventory/batches${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`),
  receiveStock: body => request('/inventory/receive', { method: 'POST', body: JSON.stringify(body) }),
  updateBatchCost: (id, purchasePrice) => request(`/inventory/batches/${id}/cost`, { method: 'PATCH', body: JSON.stringify({ purchasePrice }) }),
  stockMovements: () => request('/inventory/movements'),
  invoices: (q = '') => request(`/invoices${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  invoice: id => request(`/invoices/${id}`),
  createInvoice: body => request('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  updateInvoice: (id, body) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  payments: id => request(`/payments/invoices/${id}`),
  settings: () => request('/settings'),
  updateSettings: body => request('/settings', { method: 'PUT', body: JSON.stringify(body) })
};
