import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { TOKEN_KEY, USER_KEY, ROLE_KEY } from './auth';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

// Paths that must not trigger a /login redirect on 401
const NO_REDIRECT_PATHS = ['/auth/login', '/auth/me'];

async function handleUnauthorized() {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ROLE_KEY]);
    router.replace('/login' as any);
  } catch {}
}

async function req(path: string, opts: RequestInit = {}) {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });

  if (res.status === 401) {
    const skip = NO_REDIRECT_PATHS.some(p => path.endsWith(p));
    if (!skip) {
      handleUnauthorized();
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
  dashboard: (period: string = 'all') => req(`/dashboard?period=${encodeURIComponent(period)}`),

  orders: {
    list: () => req('/orders'),
    get: (id: string) => req(`/orders/${id}`),
    nextNumber: () => req('/orders/next_number'),
    create: (data: any) => req('/orders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/orders/${id}`, { method: 'DELETE' }),
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
    list: () => req('/leads'),
    get: (id: string) => req(`/leads/${id}`),
    create: (data: any) => req('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/leads/${id}`, { method: 'DELETE' }),
    activityStats: () => req('/leads/activity/stats'),
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
    create: (data: { name: string; login: string; password: string; role?: string }) =>
      req('/users', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/users/${id}`, { method: 'DELETE' }),
    stats: (id: string) => req(`/users/${id}/stats`),
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
