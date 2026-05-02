import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, ThemeMode } from './theme';

const STORAGE_KEY = 'crm.themeMode';

type Ctx = {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  ready: boolean;
};

const ThemeContext = createContext<Ctx>({
  mode: 'dark',
  toggle: () => {},
  setMode: () => {},
  ready: false,
});

export function ThemeProvider({ children }: { children: (mode: ThemeMode) => ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      const m: ThemeMode = v === 'light' ? 'light' : 'dark';
      applyTheme(m);
      setModeState(m);
      setReady(true);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    applyTheme(m);
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});

    // На вебе StyleSheet.create кешируется на уровне модуля. Делаем hard reload
    // с cache-busting, чтобы пересобрать стили с новой палитрой.
    if (Platform.OS === 'web') {
      try { (window as any).localStorage.setItem('crm.themeMode', m); } catch (_) {}
      setTimeout(() => {
        try {
          const url = new URL((window as any).location.href);
          url.searchParams.set('_t', String(Date.now()));
          (window as any).location.href = url.toString();
        } catch (_) {
          try { (window as any).location.reload(); } catch (_) {}
        }
      }, 100);
    }
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode, ready }}>
      {ready ? children(mode) : null}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
