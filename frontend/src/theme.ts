export const lightTheme = {
  dark: false,
  colors: {
    bg: '#EDEFF3',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSecondary: '#F4F6FA',
    surfaceHigh: '#E8ECF2',
    card: '#FFFFFF',

    textPrimary: '#0E1726',
    textSecondary: '#5A6573',
    textTertiary: '#8A93A0',
    textOnAccent: '#FFFFFF',

    accent: '#1366F0',
    accentBright: '#1366F0',
    accentLight: 'rgba(19,102,240,0.1)',
    info: '#1366F0',

    profit: '#1E9E5A',
    profitLight: 'rgba(30,158,90,0.13)',
    loss: '#E0473B',
    lossLight: 'rgba(224,71,59,0.1)',
    warning: '#D97706',
    warningLight: 'rgba(217,119,6,0.13)',

    border: 'rgba(14,23,38,0.08)',
    borderStrong: 'rgba(14,23,38,0.16)',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.4)',

    tabBar: 'rgba(255,255,255,0.95)',
    tabBarActive: '#1366F0',
    tabBarInactive: '#8A93A0',

    purple: '#7C3AED',
    purpleLight: 'rgba(124,58,237,0.13)',
  },
  gradients: {
    blue:   ['rgba(19,102,240,0.08)', 'rgba(19,102,240,0.04)'] as [string, string],
    green:  ['rgba(30,158,90,0.1)', 'rgba(30,158,90,0.05)'] as [string, string],
    orange: ['rgba(217,119,6,0.1)', 'rgba(217,119,6,0.05)'] as [string, string],
    purple: ['rgba(124,58,237,0.1)', 'rgba(124,58,237,0.05)'] as [string, string],
    pink: ['#FF2D55', '#FF6B8A'] as [string, string],
    card1: ['#0E1726', '#3A4A6B'] as [string, string],
    card2: ['rgba(255,236,214,0.95)', 'rgba(255,213,170,0.85)'] as [string, string],
    card3: ['rgba(224,224,255,0.95)', 'rgba(208,191,255,0.85)'] as [string, string],
    card4: ['#43e97b', '#38f9d7'] as [string, string],
    blueAccent:   '#1366F0',
    greenAccent:  '#1E9E5A',
    purpleAccent: '#7C3AED',
    orangeAccent: '#D97706',
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    bg: '#000000',
    surface: '#1C1C1E',
    surfaceElevated: '#2C2C2E',
    surfaceSecondary: '#141414',
    surfaceHigh: '#3A3A3C',
    card: '#1C1C1E',

    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(235,235,245,0.6)',
    textTertiary: 'rgba(235,235,245,0.3)',
    textOnAccent: '#FFFFFF',

    accent: '#0A84FF',
    accentBright: '#409CFF',
    accentLight: 'rgba(10,132,255,0.15)',
    info: '#0A84FF',

    profit: '#32D74B',
    profitLight: 'rgba(50,215,75,0.15)',
    loss: '#FF453A',
    lossLight: 'rgba(255,69,58,0.15)',
    warning: '#FF9F0A',
    warningLight: 'rgba(255,159,10,0.15)',

    border: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.2)',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.6)',

    tabBar: 'rgba(28,28,30,0.92)',
    tabBarActive: '#0A84FF',
    tabBarInactive: 'rgba(235,235,245,0.3)',
  },
  gradients: {
    blue: ['#0A84FF', '#30B0C7'] as [string, string],
    green: ['#32D74B', '#30D158'] as [string, string],
    orange: ['#FF9F0A', '#FF6B35'] as [string, string],
    purple: ['#BF5AF2', '#7B68EE'] as [string, string],
    pink: ['#FF375F', '#FF6B8A'] as [string, string],
    card1: ['#667eea', '#764ba2'] as [string, string],
    card2: ['#f093fb', '#f5576c'] as [string, string],
    card3: ['#4facfe', '#00f2fe'] as [string, string],
    card4: ['#43e97b', '#38f9d7'] as [string, string],
    blueAccent:   '#0A84FF',
    greenAccent:  '#32D74B',
    purpleAccent: '#BF5AF2',
    orangeAccent: '#FF9F0A',
  },
};

export type ThemeMode = 'dark' | 'light';
export type Theme = typeof lightTheme;

export const theme = {
  dark: false,
  mode: 'light' as ThemeMode,
  colors: { ...lightTheme.colors },
  gradients: { ...lightTheme.gradients },
};

export function bootstrapTheme(mode?: ThemeMode): ThemeMode {
  if (mode !== undefined) {
    try {
      if (typeof window !== 'undefined' && (window as any).localStorage) {
        (window as any).localStorage.setItem('theme_mode', mode);
      }
    } catch (_) {}
    applyTheme(mode);
    return mode;
  }
  try {
    if (typeof window !== 'undefined' && (window as any).localStorage) {
      const saved = (window as any).localStorage.getItem('theme_mode');
      if (saved === 'light' || saved === 'dark') {
        applyTheme(saved as ThemeMode);
        return saved as ThemeMode;
      }
    }
  } catch (_) {}
  return 'light';
}

bootstrapTheme();

export function applyTheme(mode: ThemeMode) {
  const t = mode === 'dark' ? darkTheme : lightTheme;
  theme.dark = t.dark;
  theme.mode = mode;
  Object.assign(theme.colors, t.colors);
  Object.assign(theme.gradients, t.gradients);
}

export const formatMoney = (n: number) => {
  if (!n && n !== 0) return '0 Br';
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' Br';
};

export const formatShort = (n: number) => {
  if (!n && n !== 0) return '0';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'К';
  return String(Math.round(n));
};

export const statusLabels: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  delivered: 'Доставлено',
  cancelled: 'Отменено',
};

export const statusColors: Record<string, string> = {
  new: '#1366F0',
  in_progress: '#D97706',
  delivered: '#1E9E5A',
  cancelled: '#E0473B',
};

export const docsLabels: Record<string, string> = {
  not_sent: 'Не отправлены',
  sent: 'Отправлены',
  received: 'Получены',
};

export const leadStatusLabels: Record<string, string> = {
  new: 'Новый',
  thinking: 'Думают',
  sent_kp: 'Выслал КП',
  won: 'Клиент',
  lost: 'Потерян',
  callback: 'Перезвонить',
};

export const leadStatusColors: Record<string, string> = {
  new: '#1366F0',
  thinking: '#D97706',
  sent_kp: '#D97706',
  won: '#1E9E5A',
  lost: '#8A93A0',
  callback: '#7C3AED',
};
