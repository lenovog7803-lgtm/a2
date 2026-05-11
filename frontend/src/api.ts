const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  dashboard: (period: string = 'all') => req(`/dashboard?period=${encodeURIComponent(period)}`),

  orders: {
    list: () => req('/orders'),
    get: (id: string) => req(`/orders/${id}`),
    nextNumber: () => req('/orders/next_number'),
    create: (data: any) => req('/orders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/orders/${id}`, { method: 'DELETE' }),
    generateDoc: (id: string, kind: 'client' | 'carrier' | 'act', regenerate = false) =>
      req(`/orders/${id}/docs/${kind}${regenerate ? '?regenerate=true' : ''}`, { method: 'POST' }),
  },
  clients: {
    list: () => req('/clients'),
    get: (id: string) => req(`/clients/${id}`),
    create: (data: any) => req('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/clients/${id}`, { method: 'DELETE' }),
  },
  carriers: {
    list: () => req('/carriers'),
    get: (id: string) => req(`/carriers/${id}`),
    create: (data: any) => req('/carriers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/carriers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/carriers/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: () => req('/tasks'),
    create: (data: any) => req('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/tasks/${id}`, { method: 'DELETE' }),
  },
  leads: {
    list: () => req('/leads'),
    get: (id: string) => req(`/leads/${id}`),
    create: (data: any) => req('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/leads/${id}`, { method: 'DELETE' }),
    activityStats: () => req('/leads/activity/stats'),
  },
  sync: {
    importFromSheets: () => req('/sync/import_from_sheets', { method: 'POST' }),
    importStatus: () => req('/sync/import_status'),
    sheets: () => req('/sync/sheets', { method: 'POST' }),
    status: () => req('/sync/sheets/status'),
  },
  auth: {
    googleStart: () => req('/auth/google/start'),
    googleStatus: () => req('/auth/google/status'),
    googleDisconnect: () => req('/auth/google', { method: 'DELETE' }),
  },
  finance: {
    withdrawals: {
      list: () => req('/finance/withdrawals'),
      create: (data: any) => req('/finance/withdrawals', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => req(`/finance/withdrawals/${id}`, { method: 'DELETE' }),
    },
    transactions: {
      list: () => req('/finance/transactions'),
      create: (data: any) => req('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => req(`/finance/transactions/${id}`, { method: 'DELETE' }),
    },
  },
  seed: () => req('/seed', { method: 'POST' }),
};
