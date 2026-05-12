import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bootstrapTheme, ThemeMode } from './theme';

const STORAGE_KEY = 'theme_mode';

type Ctx = {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
  ready: boolean;
};

const ThemeContext = createContext<Ctx>({
  mode: 'dark',
  toggleTheme: () => {},
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

  const toggleTheme = () => setMode(mode === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode, ready }}>
      {ready ? <React.Fragment key={mode}>{children(mode)}</React.Fragment> : null}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
