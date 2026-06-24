const BASE = 'https://logistics-crm-backend.onrender.com';

function getToken() {
  return localStorage.getItem('jwt_token');
}

async function req(path, opts = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (res.status === 401) {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
    if (!path.endsWith('/auth/login') && !path.endsWith('/auth/me')) {
      window.location.hash = '#/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  dashboard: (period = 'all') => req(`/dashboard?period=${encodeURIComponent(period)}`),
  dayOrders: (date) => req(`/dashboard/day_orders?date=${encodeURIComponent(date)}`),

  orders: {
    list: () => req('/orders'),
    get: (id) => req(`/orders/${id}`),
    nextNumber: () => req('/orders/next_number'),
    create: (data) => req('/orders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => req(`/orders/${id}`, { method: 'DELETE' }),
    duplicate: (id) => req(`/orders/${id}/duplicate`, { method: 'POST' }),
    logs: (id) => req(`/orders/${id}/logs`),
    generateDoc: (id, kind, regenerate = false) =>
      req(`/orders/${id}/docs/${kind}${regenerate ? '?regenerate=true' : ''}`, { method: 'POST' }),
  },
  clients: {
    list: () => req('/clients'),
    get: (id) => req(`/clients/${id}`),
    create: (data) => req('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => req(`/clients/${id}`, { method: 'DELETE' }),
    generateActs: (clientId) => req(`/clients/${clientId}/generate_acts`, { method: 'POST' }),
  },
  carriers: {
    list: () => req('/carriers'),
    get: (id) => req(`/carriers/${id}`),
    create: (data) => req('/carriers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/carriers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => req(`/carriers/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: () => req('/tasks'),
    get: (id) => req(`/tasks/${id}`),
    create: (data) => req('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => req(`/tasks/${id}`, { method: 'DELETE' }),
  },
  leads: {
    list: (industry) => req(`/leads${industry ? `?industry=${encodeURIComponent(industry)}` : ''}`),
    get: (id) => req(`/leads/${id}`),
    create: (data) => req('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => req(`/leads/${id}`, { method: 'DELETE' }),
    addCallNote: (id, text) => req(`/leads/${id}/call_notes`, { method: 'POST', body: JSON.stringify({ text }) }),
    deleteCallNote: (id, noteIndex) => req(`/leads/${id}/call_notes/${noteIndex}`, { method: 'DELETE' }),
    activityStats: () => req('/leads/activity/stats'),
    industries: () => req('/leads/industries'),
  },
  notes: {
    list: () => req('/notes'),
    create: (data) => req('/notes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => req(`/notes/${id}`, { method: 'DELETE' }),
  },
  auth: {
    login: (login, password) =>
      req('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
    me: () => req('/auth/me'),
  },
  users: {
    list: () => req('/users'),
    create: (data) => req('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => req(`/users/${id}`, { method: 'DELETE' }),
    stats: (id, month) => req(`/users/${id}/stats${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    activitySummary: () => req('/users/activity_summary'),
    orders: (id, month) => req(`/users/${id}/orders${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    leads: (id) => req(`/users/${id}/leads`),
  },
  finance: {
    withdrawals: {
      list: () => req('/finance/withdrawals'),
      create: (data) => req('/finance/withdrawals', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id) => req(`/finance/withdrawals/${id}`, { method: 'DELETE' }),
    },
    transactions: {
      list: () => req('/finance/transactions'),
      create: (data) => req('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id) => req(`/finance/transactions/${id}`, { method: 'DELETE' }),
    },
  },
  paymentsIn: {
    list: (filters) => {
      const p = new URLSearchParams();
      if (filters?.client_id) p.append('client_id', filters.client_id);
      if (filters?.month) p.append('month', filters.month);
      const qs = p.toString();
      return req(`/payments/in${qs ? '?' + qs : ''}`);
    },
    create: (data) => req('/payments/in', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/payments/in/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => req(`/payments/in/${id}`, { method: 'DELETE' }),
  },
  paymentsOut: {
    list: (filters) => {
      const p = new URLSearchParams();
      if (filters?.carrier_id) p.append('carrier_id', filters.carrier_id);
      if (filters?.month) p.append('month', filters.month);
      const qs = p.toString();
      return req(`/payments/out${qs ? '?' + qs : ''}`);
    },
    create: (data) => req('/payments/out', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/payments/out/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => req(`/payments/out/${id}`, { method: 'DELETE' }),
  },
  reconciliation: {
    generate: (data) => req('/reconciliation/generate', { method: 'POST', body: JSON.stringify(data) }),
    history: (params) => {
      const p = new URLSearchParams();
      if (params?.counterparty_id) p.append('counterparty_id', params.counterparty_id);
      if (params?.type) p.append('type', params.type);
      const qs = p.toString();
      return req(`/reconciliation/history${qs ? '?' + qs : ''}`);
    },
  },
  goals: {
    get: (month) => req(`/goals?month=${encodeURIComponent(month)}`),
    save: (data) => req('/goals', { method: 'POST', body: JSON.stringify(data) }),
  },
  analytics: (month) => req(`/analytics${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  settings: {
    get: () => req('/settings'),
    update: (data) => req('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  globalSearch: (q) => req(`/search?q=${encodeURIComponent(q)}`),
};

export function fmtMoney(v, decimals = 0) {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtShort(v) {
  const n = Number(v);
  if (!n) return '0';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + 'K';
  return String(Math.round(n));
}

export const GRADIENTS = [
  ['#A5D8FF', '#1366F0'],
  ['#D0BFFF', '#7C3AED'],
  ['#A7F3D0', '#1E9E5A'],
  ['#FCD34D', '#D97706'],
  ['#FCA5A5', '#E0473B'],
  ['#BAE6FD', '#0891B2'],
];

export function avatarIdx(name) { return (name?.charCodeAt(0) || 0) % GRADIENTS.length; }
export function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export const STATUS_LABELS = { new: 'Новая', in_progress: 'В работе', delivered: 'Доставлено', cancelled: 'Отменено' };
export const STATUS_COLORS = {
  new:         { color: '#1366F0', bg: 'rgba(19,102,240,0.12)' },
  in_progress: { color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
  delivered:   { color: '#1E9E5A', bg: 'rgba(30,158,90,0.12)' },
  cancelled:   { color: '#E0473B', bg: 'rgba(224,71,59,0.12)' },
};

export const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
export const MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function monthLabel(ym) {
  if (!ym || ym === 'all') return 'Все время';
  const [y, m] = ym.split('-');
  return `${MONTHS_FULL[parseInt(m, 10) - 1]} ${y}`;
}
