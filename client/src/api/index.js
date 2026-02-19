const BASE = '';

async function get(url) {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function post(url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

async function put(url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}`);
  return res.json();
}

const api = {
  // Dashboard
  getDashboard: () => get('/api/dashboard/summary'),

  // Notifications
  getNotifications: (status) => get(`/api/notifications${status ? `?status=${status}` : ''}`),
  acknowledgeNotification: (id) => post(`/api/notifications/${id}/acknowledge`),

  // Work Orders
  getWorkOrders: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.property_id) params.set('property_id', filters.property_id);
    const qs = params.toString();
    return get(`/api/work-orders${qs ? `?${qs}` : ''}`);
  },
  getWorkOrder: (id) => get(`/api/work-orders/${id}`),
  updateWorkOrder: (id, data) => put(`/api/work-orders/${id}`, data),
  approveWorkOrder: (id) => post(`/api/work-orders/${id}/approve`),

  // Tenants
  getTenants: () => get('/api/tenants'),
  getTenant: (id) => get(`/api/tenants/${id}`),

  // Properties
  getProperties: () => get('/api/properties'),

  // Rent Ledger
  getRentLedger: (month, year) => get(`/api/rent-ledger?month=${month}&year=${year}`),
  getCurrentLedger: () => get('/api/rent-ledger/current'),
  getDelinquent: (month, year) => get(`/api/rent-ledger/delinquent?month=${month || 2}&year=${year || 2026}`),
  getTenantLedger: (id) => get(`/api/rent-ledger/tenant/${id}`),
  recordPayment: (ledgerId, data) => post(`/api/rent-ledger/${ledgerId}/record-payment`, data),

  // Conversations
  getRecentConversations: (limit = 20) => get(`/api/conversations?limit=${limit}`),
  getTenantConversations: (tenantId) => get(`/api/conversations/${tenantId}`),

  // Collection
  approvePayOrQuit: (tenantId, month, year) => post(`/api/collection/${tenantId}/approve-pay-or-quit`, { month, year }),
  createPaymentPlan: (tenantId, data) => post(`/api/collection/${tenantId}/payment-plan`, data),

  // Applications
  getApplications: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.unit_id) params.set('unit_id', filters.unit_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.property_id) params.set('property_id', filters.property_id);
    const qs = params.toString();
    return get(`/api/applications${qs ? `?${qs}` : ''}`);
  },
  approveApplication: (id) => post(`/api/applications/${id}/approve`),
  denyApplication: (id, reason) => post(`/api/applications/${id}/deny`, { reason }),
  reviewApplication: (id) => post(`/api/applications/${id}/review`),

  // Vendors
  getVendors: () => get('/api/vendors'),
};

export default api;
