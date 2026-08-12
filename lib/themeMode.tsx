import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkPalette, lightPalette, type Colors } from './theme';
import { useAccentTheme } from './accentTheme';

const STORAGE_KEY = 'nestchat.themeMode';
const LEGACY_DEEP_GROUND_KEY = 'nestchat.deepGround';

export type ThemeModeSetting = 'system' | 'light' | 'dark';

interface ThemeModeValue {
  mode: ThemeModeSetting;
  /** The resolved ground after applying 'system', for anything that needs to know light vs dark. */
  resolvedGround: 'light' | 'dark';
  setMode: (value: ThemeModeSetting) => void;
  /** Legacy convenience field — the active ground's `bg`, for files not yet migrated to useTheme(). */
  bg: string;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeModeSetting>('dark');
  const systemScheme = useColorScheme();

  useEffect(() => {
    // State already defaults to 'dark', which is also where the old boolean toggle always
    // landed (it only ever chose between two dark shades) -- so the only real migration work
    // is dropping the now-unused legacy key.
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'system' || v === 'light' || v === 'dark') setModeState(v);
    });
    AsyncStorage.removeItem(LEGACY_DEEP_GROUND_KEY);
  }, []);

  function setMode(value: ThemeModeSetting) {
    setModeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value);
  }

  const resolvedGround: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo(
    () => ({
      mode,
      resolvedGround,
      setMode,
      bg: resolvedGround === 'light' ? lightPalette.bg : darkPalette.bg,
    }),
    [mode, resolvedGround]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}

/**
 * The composed theme: the active ground palette (light/dark, following the mode setting) with
 * the user's accent ramp layered on top. This is what screen/component code should read colors
 * from going forward — `colors`/`useThemeMode().bg` stay around only for files not yet migrated.
 */
export function useTheme(): Colors {
  const { resolvedGround } = useThemeMode();
  const { colors: accentRamp } = useAccentTheme();
  const ground = resolvedGround === 'light' ? lightPalette : darkPalette;
  // accentRamp already merges darkPalette + the accent ramp (see AccentThemeProvider) — re-spread
  // the resolved ground first so its non-accent tokens win, then layer just the accent keys back on.
  return {
    ...ground,
    accent: accentRamp.accent,
    accent2: accentRamp.accent2,
    accent100: accentRamp.accent100,
    accent200: accentRamp.accent200,
    accent300: accentRamp.accent300,
    accent400: accentRamp.accent400,
    accent500: accentRamp.accent500,
    accent600: accentRamp.accent600,
    accent700: accentRamp.accent700,
    accent800: accentRamp.accent800,
    accent900: accentRamp.accent900,
  };
}
