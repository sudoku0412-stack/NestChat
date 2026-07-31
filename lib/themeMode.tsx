import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './theme';

const STORAGE_KEY = 'nestchat.deepGround';

interface ThemeModeValue {
  deepGround: boolean;
  bg: string;
  setDeepGround: (value: boolean) => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [deepGround, setDeepGroundState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === '1') setDeepGroundState(true);
    });
  }, []);

  function setDeepGround(value: boolean) {
    setDeepGroundState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  }

  const value = useMemo(
    () => ({ deepGround, bg: deepGround ? colors.bgDeep : colors.bg, setDeepGround }),
    [deepGround]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
