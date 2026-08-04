import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import { buildAccentRamp, colors, DEFAULT_ACCENT_HEX, type Colors } from './theme';

interface AccentThemeValue {
  colors: Colors;
  accentHex: string;
  /** Returns an error message on failure, or null on success — mirrors setPin's convention. */
  setAccentColor: (hex: string) => Promise<string | null>;
}

const AccentThemeContext = createContext<AccentThemeValue | null>(null);

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const accentHex = profile?.theme_accent || DEFAULT_ACCENT_HEX;

  const themedColors = useMemo<Colors>(() => ({ ...colors, ...buildAccentRamp(accentHex) }), [accentHex]);

  async function setAccentColor(hex: string) {
    if (!profile) return 'No profile loaded — try again.';
    const { error } = await supabase.from('users').update({ theme_accent: hex }).eq('id', profile.id);
    if (error) return error.message;
    await refreshProfile();
    return null;
  }

  // Not memoized: setAccentColor closes over `profile`, which can change without accentHex
  // changing (e.g. profile loading in after this provider's first render) — memoizing on
  // [themedColors, accentHex] alone would freeze setAccentColor's closure on a stale (possibly
  // null) profile. This object is cheap to build, so there's no real cost to skipping memoization.
  const value = { colors: themedColors, accentHex, setAccentColor };

  return <AccentThemeContext.Provider value={value}>{children}</AccentThemeContext.Provider>;
}

export function useAccentTheme() {
  const ctx = useContext(AccentThemeContext);
  if (!ctx) throw new Error('useAccentTheme must be used within AccentThemeProvider');
  return ctx;
}
