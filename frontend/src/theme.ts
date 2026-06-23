export const lightTheme = {
  dark: false,
  colors: {
    bg: '#EDEFF3',
    surface: 'rgba(255,255,255,0.58)',
    surfaceElevated: 'rgba(255,255,255,0.82)',
    surfaceSecondary: 'rgba(255,255,255,0.42)',
    surfaceHigh: '#E8ECF2',
    card: 'rgba(255,255,255,0.6)',

    textPrimary: '#0E1726',
    textSecondary: '#5A6573',
    textTertiary: '#8A93A0',
    textMuted: '#A6AEB8',
    textOnAccent: '#FFFFFF',

    accent: '#1366F0',
    accentBright: '#1366F0',
    accentLight: 'rgba(19,102,240,0.10)',
    accentDark: '#0E4EC7',
    info: '#1366F0',

    profit: '#1E9E5A',
    profitLight: 'rgba(30,158,90,0.10)',
    loss: '#E0473B',
    lossLight: 'rgba(224,71,59,0.10)',
    warning: '#D97706',
    warningLight: 'rgba(217,119,6,0.12)',

    border: 'rgba(255,255,255,0.72)',
    borderStrong: 'rgba(14,23,38,0.16)',
    borderInner: 'rgba(14,23,38,0.06)',
    shadow: 'rgba(20,30,55,0.22)',
    overlay: 'rgba(0,0,0,0.4)',

    // glassmorphism
    glass: 'rgba(255,255,255,0.58)',
    glassStrong: 'rgba(255,255,255,0.82)',
    glassBorder: 'rgba(255,255,255,0.72)',

    tabBar: 'rgba(255,255,255,0.95)',
    tabBarActive: '#1366F0',
    tabBarInactive: '#8A93A0',

    sidebar: '#FFFFFF',
    sidebarBg: '#F4F5F8',

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
  fonts: {
    heading: 'Onest_700Bold',
    headingXBold: 'Onest_800ExtraBold',
    body: 'Manrope_500Medium',
    bodyBold: 'Manrope_700Bold',
    mono: undefined as string | undefined, // JetBrains Mono if loaded
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    bg: '#0E1726',
    surface: 'rgba(255,255,255,0.06)',
    surfaceElevated: 'rgba(255,255,255,0.10)',
    surfaceSecondary: 'rgba(255,255,255,0.04)',
    surfaceHigh: '#1C2538',
    card: 'rgba(255,255,255,0.07)',

    textPrimary: '#F0F2F5',
    textSecondary: '#8A93A0',
    textTertiary: '#5A6573',
    textMuted: '#3D4756',
    textOnAccent: '#FFFFFF',

    accent: '#1366F0',
    accentBright: '#5B9BFF',
    accentLight: 'rgba(19,102,240,0.18)',
    accentDark: '#5B9BFF',
    info: '#1366F0',

    profit: '#1E9E5A',
    profitLight: 'rgba(30,158,90,0.15)',
    loss: '#E0473B',
    lossLight: 'rgba(224,71,59,0.15)',
    warning: '#D97706',
    warningLight: 'rgba(217,119,6,0.15)',

    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.2)',
    borderInner: 'rgba(255,255,255,0.06)',
    shadow: 'rgba(0,0,0,0.4)',
    overlay: 'rgba(0,0,0,0.6)',

    glass: 'rgba(255,255,255,0.06)',
    glassStrong: 'rgba(255,255,255,0.12)',
    glassBorder: 'rgba(255,255,255,0.10)',

    tabBar: 'rgba(28,28,30,0.92)',
    tabBarActive: '#5B9BFF',
    tabBarInactive: 'rgba(235,235,245,0.3)',

    sidebar: '#131E30',
    sidebarBg: '#0E1726',

    purple: '#7C3AED',
    purpleLight: 'rgba(124,58,237,0.2)',
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
  fonts: {
    heading: 'Onest_700Bold',
    headingXBold: 'Onest_800ExtraBold',
    body: 'Manrope_500Medium',
    bodyBold: 'Manrope_700Bold',
    mono: undefined as string | undefined,
  },
};

export type ThemeMode = 'dark' | 'light';
export type Theme = typeof lightTheme;

export const theme = {
  dark: false,
  mode: 'light' as ThemeMode,
  colors: { ...lightTheme.colors },
  gradients: { ...lightTheme.gradients },
  fonts: { ...lightTheme.fonts },
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
  Object.assign(theme.fonts, t.fonts);
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
