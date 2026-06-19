// Apple/Linear/Modern SaaS палитра. theme.colors — мутабельный объект,
// чтобы StyleSheet.create читал актуальные значения после переключения.

export const lightTheme = {
  colors: {
    // Фоны
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSecondary: '#F8F8FC',
    surfaceHigh: '#EFEFF4',

    // Текст
    textPrimary: '#1C1C1E',
    textSecondary: '#6B6B7B',
    textTertiary: '#AEAEB2',

    // Акцент — синий Apple
    accent: '#007AFF',
    accentBright: '#007AFF',
    accentLight: '#E8F2FF',
    accentDark: '#0055CC',

    // Семантические
    profit: '#34C759',
    profitLight: '#E8F8ED',
    loss: '#FF3B30',
    lossLight: '#FFF0EF',
    warning: '#FF9500',
    warningLight: '#FFF5E6',
    info: '#007AFF',

    // Градиенты карточек
    gradientBlue: ['#007AFF', '#5AC8FA'] as string[],
    gradientGreen: ['#34C759', '#30D158'] as string[],
    gradientOrange: ['#FF9500', '#FF6B00'] as string[],
    gradientPurple: ['#AF52DE', '#7B68EE'] as string[],

    // UI
    border: 'rgba(0,0,0,0.08)',
    borderLight: 'rgba(0,0,0,0.04)',
    borderStrong: 'rgba(0,0,0,0.16)',
    shadow: 'rgba(0,0,0,0.08)',
    overlay: 'rgba(0,0,0,0.5)',

    // Нижнее меню
    tabBar: 'rgba(255,255,255,0.85)',
    tabBarBorder: 'rgba(0,0,0,0.1)',
  },
  dark: false,
};

export const darkTheme = {
  colors: {
    bg: '#000000',
    surface: '#1C1C1E',
    surfaceElevated: '#2C2C2E',
    surfaceSecondary: '#141414',
    surfaceHigh: '#3A3A3C',

    textPrimary: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#6B6B7B',

    accent: '#0A84FF',
    accentBright: '#409CFF',
    accentLight: '#0A84FF20',
    accentDark: '#409CFF',
    info: '#0A84FF',

    profit: '#32D74B',
    profitLight: '#32D74B20',
    loss: '#FF453A',
    lossLight: '#FF453A20',
    warning: '#FF9F0A',
    warningLight: '#FF9F0A20',

    gradientBlue: ['#0A84FF', '#30B0C7'] as string[],
    gradientGreen: ['#32D74B', '#30D158'] as string[],
    gradientOrange: ['#FF9F0A', '#FF6B00'] as string[],
    gradientPurple: ['#BF5AF2', '#7B68EE'] as string[],

    border: 'rgba(255,255,255,0.1)',
    borderLight: 'rgba(255,255,255,0.05)',
    borderStrong: 'rgba(255,255,255,0.2)',
    shadow: 'rgba(0,0,0,0.3)',
    overlay: 'rgba(0,0,0,0.7)',

    tabBar: 'rgba(28,28,30,0.85)',
    tabBarBorder: 'rgba(255,255,255,0.1)',
  },
  dark: true,
};

export type ThemeMode = 'dark' | 'light';
export type Theme = typeof lightTheme;

export const theme = {
  mode: 'light' as ThemeMode,
  colors: { ...lightTheme.colors },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  radius: { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 },
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
  const palette = mode === 'dark' ? darkTheme.colors : lightTheme.colors;
  theme.mode = mode;
  Object.assign(theme.colors, palette);
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
