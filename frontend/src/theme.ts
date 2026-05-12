// Премиум палитры. theme.colors — мутабельный объект, чтобы StyleSheet.create
// читал актуальные значения после переключения и перемонтирования (через key в _layout).

const DARK = {
  bg: '#0A0A0C',
  surface: '#121215',
  surfaceElevated: '#1C1C20',
  surfaceHigh: '#26262C',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  accent: '#C0A062',
  accentBright: '#D4AF37',
  profit: '#00E676',
  loss: '#FF3B30',
  warning: '#F59E0B',
  info: '#60A5FA',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
};

const LIGHT = {
  bg: '#F4F2EE',          // тёплый, чуть кремовый фон
  surface: '#FFFFFF',
  surfaceElevated: '#F8F6F2',
  surfaceHigh: '#EFEBE3',
  textPrimary: '#0E0E10',
  textSecondary: '#3F3F46',
  textTertiary: '#6B6B73',
  accent: '#A07A2E',       // более насыщенное золото для контраста на светлом
  accentBright: '#C39C3F',
  profit: '#0A8C3E',
  loss: '#D4351C',
  warning: '#B8740F',
  info: '#1E5BB5',
  border: 'rgba(14,14,16,0.10)',
  borderStrong: 'rgba(14,14,16,0.20)',
};

export type ThemeMode = 'dark' | 'light';

export const theme = {
  mode: 'dark' as ThemeMode,
  colors: { ...DARK },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  radius: { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 },
};

// Синхронный bootstrap для веба. Вызвать из _layout до рендера, чтобы стили в дочерних
// модулях прочитали правильные цвета.
// Если передать mode — записывает в localStorage и применяет палитру.
// Без аргумента — читает из localStorage и возвращает сохранённый режим.
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
  return 'dark';
}

// Запускаем сразу при импорте (для случаев SSR/Hot reload).
bootstrapTheme();

/** Применяет палитру выбранного режима к мутабельному объекту theme.
 *  ВАЖНО: после вызова нужно перемонтировать дерево (через key={mode} в корне),
 *  иначе уже созданные StyleSheet'ы не пересчитаются.
 */
export function applyTheme(mode: ThemeMode) {
  const palette = mode === 'light' ? LIGHT : DARK;
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
  new: '#60A5FA',
  in_progress: '#F59E0B',
  delivered: '#00E676',
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
  new: '#60A5FA',
  thinking: '#F59E0B',
  sent_kp: '#F97316',
  won: '#00E676',
  lost: '#71717A',
  callback: '#8B5CF6',
};
