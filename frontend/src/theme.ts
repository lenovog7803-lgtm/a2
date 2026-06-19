export const lightTheme = {
  dark: false,
  colors: {
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSecondary: '#F8F8FC',
    surfaceHigh: '#EFEFF4',
    card: '#FFFFFF',

    textPrimary: '#1C1C1E',
    textSecondary: '#6B6B7B',
    textTertiary: '#AEAEB2',
    textOnAccent: '#FFFFFF',

    accent: '#007AFF',
    accentBright: '#007AFF',
    accentLight: '#E8F2FF',
    info: '#007AFF',

    profit: '#34C759',
    profitLight: '#E8F8ED',
    loss: '#FF3B30',
    lossLight: '#FFF0EF',
    warning: '#FF9500',
    warningLight: '#FFF5E6',

    border: 'rgba(0,0,0,0.08)',
    borderStrong: 'rgba(0,0,0,0.16)',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.4)',

    tabBar: 'rgba(255,255,255,0.92)',
    tabBarActive: '#007AFF',
    tabBarInactive: '#8E8E93',
  },
  gradients: {
    blue: ['#007AFF', '#5AC8FA'] as [string, string],
    green: ['#34C759', '#30D158'] as [string, string],
    orange: ['#FF9500', '#FF6B35'] as [string, string],
    purple: ['#AF52DE', '#7B68EE'] as [string, string],
    pink: ['#FF2D55', '#FF6B8A'] as [string, string],
    card1: ['#667eea', '#764ba2'] as [string, string],
    card2: ['#f093fb', '#f5576c'] as [string, string],
    card3: ['#4facfe', '#00f2fe'] as [string, string],
    card4: ['#43e97b', '#38f9d7'] as [string, string],
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
  new: '#007AFF',
  in_progress: '#FF9500',
  delivered: '#34C759',
  cancelled: '#FF3B30',
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
  new: '#007AFF',
  thinking: '#FF9500',
  sent_kp: '#FF6B00',
  won: '#34C759',
  lost: '#AEAEB2',
  callback: '#AF52DE',
};
