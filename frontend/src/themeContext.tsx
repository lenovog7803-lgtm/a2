import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bootstrapTheme, ThemeMode } from './theme';

const STORAGE_KEY = 'theme_mode';

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
      bootstrapTheme(m);
      setModeState(m);
      setReady(true);
    }).catch(() => {
      bootstrapTheme('dark');
      setReady(true);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    bootstrapTheme(m);
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode, ready }}>
      {ready ? <React.Fragment key={mode}>{children(mode)}</React.Fragment> : null}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
