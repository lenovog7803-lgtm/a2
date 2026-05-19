import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

async function req(path: string, opts: RequestInit = {}) {
  // Берём токен из AsyncStorage перед каждым запросом
  let token: string | null = null;
  try { token = await AsyncStorage.getItem('jwt_token'); } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });

  if (res.status === 401) {
    // Очищаем токен и редиректим на логин
    try {
      await AsyncStorage.multiRemove(['jwt_token', 'user_role', 'user_data']);
      // Avoid redirect loop for the login/me endpoints themselves
      if (!path.endsWith('/auth/login') && !path.endsWith('/auth/me')) {
        const { router } = require('expo-router');
        router.replace('/login');
      }
    } catch {}
    throw new Error('Unauthorized');
  }

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
    duplicate: (id: string) => req(`/orders/${id}/duplicate`, { method: 'POST' }),
    logs: (id: string) => req(`/orders/${id}/logs`),
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
    list: (industry?: string) => req(`/leads${industry ? `?industry=${encodeURIComponent(industry)}` : ''}`),
    get: (id: string) => req(`/leads/${id}`),
    create: (data: any) => req('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/leads/${id}`, { method: 'DELETE' }),
    addCallNote: (id: string, text: string) => req(`/leads/${id}/call_notes`, { method: 'POST', body: JSON.stringify({ text }) }),
    deleteCallNote: (id: string, noteIndex: number) => req(`/leads/${id}/call_notes/${noteIndex}`, { method: 'DELETE' }),
    activityStats: () => req('/leads/activity/stats'),
    industries: () => req('/leads/industries'),
  },
  notes: {
    list: () => req('/notes'),
    create: (data: any) => req('/notes', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/notes/${id}`, { method: 'DELETE' }),
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
    login: (login: string, password: string) =>
      req('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
    me: () => req('/auth/me'),
  },
  users: {
    list: () => req('/users'),
    create: (data: { name: string; login: string; password: string; role?: string; permissions?: any }) =>
      req('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; login?: string; password?: string; role?: string; permissions?: any }) =>
      req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/users/${id}`, { method: 'DELETE' }),
    stats: (id: string, month?: string) => req(`/users/${id}/stats${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    activity: (id: string) => req(`/users/${id}/activity`),
    activitySummary: () => req('/users/activity_summary'),
    orders: (id: string, month?: string) => req(`/users/${id}/orders${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    leads: (id: string) => req(`/users/${id}/leads`),
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
  trash: {
    list: () => req('/trash'),
    restore: (collection: string, id: string) => req(`/trash/restore/${collection}/${id}`, { method: 'POST' }),
    purge: () => req('/trash/purge', { method: 'POST' }),
  },
  backup: {
    list: () => req('/backup/list'),
    create: () => req('/backup/create', { method: 'POST' }),
    restore: (id: string) => req(`/backup/restore/${id}`, { method: 'POST' }),
  },
  analytics: (month?: string) => req(`/analytics${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  settings: {
    get: () => req('/settings'),
    update: (data: any) => req('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  seed: () => req('/seed', { method: 'POST' }),
  globalSearch: (q: string) => req(`/search?q=${encodeURIComponent(q)}`),
};
