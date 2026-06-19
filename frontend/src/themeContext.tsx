import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bootstrapTheme, ThemeMode, Theme, lightTheme, darkTheme } from './theme';

const STORAGE_KEY = 'theme_mode';

type Ctx = {
  mode: ThemeMode;
  theme: Theme;
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
  ready: boolean;
};

const ThemeContext = createContext<Ctx>({
  mode: 'light',
  theme: lightTheme,
  toggleTheme: () => {},
  setMode: () => {},
  ready: false,
});

export function ThemeProvider({ children }: { children: (mode: ThemeMode) => ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      const m: ThemeMode = v === 'dark' ? 'dark' : 'light';
      bootstrapTheme(m);
      setModeState(m);
      setReady(true);
    }).catch(() => {
      bootstrapTheme('light');
      setReady(true);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    bootstrapTheme(m);
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const toggleTheme = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const currentTheme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ mode, theme: currentTheme, toggleTheme, setMode, ready }}>
      {ready ? children(mode) : null}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
