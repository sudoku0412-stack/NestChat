// Design tokens generated from the `ui-ux-pro-max` skill's design-system search for
// "private household messaging chat app" — it returned a dedicated Chat & Messaging App
// color profile (Messenger blue + indigo + emerald "online" green), Minimalism & Swiss
// Style, and Poppins/Open Sans typography. Replaces the earlier warm terracotta "Hearth"
// identity. `accent`/`accent2`/`accentXXX` map to the profile's Primary/Secondary — they
// stay the single hue-ramp the app's accent-color picker already drives (see
// `buildAccentRamp`); `success` maps to the profile's dedicated online/success green and
// is a *ground* token, not part of the user-customizable accent ramp, so "online" always
// reads as green regardless of the user's chosen brand color. Shape of every export
// (colors/space/radius/fontWeight/avatarPalette) is kept identical to the previous system
// so existing screens keep working purely from the new values.

export interface Colors {
  bg: string;
  bgDeep: string;
  surface: string;
  text: string;
  textMuted: string;
  divider: string;
  accent: string;
  accent2: string;
  neutral100: string;
  neutral200: string;
  neutral300: string;
  neutral400: string;
  neutral500: string;
  neutral600: string;
  neutral700: string;
  neutral800: string;
  neutral900: string;
  accent100: string;
  accent200: string;
  accent300: string;
  accent400: string;
  accent500: string;
  accent600: string;
  accent700: string;
  accent800: string;
  accent900: string;
  danger: string;
  success: string;
}

// Dark ground.
export const darkPalette: Colors = {
  bg: '#0F172A',
  bgDeep: '#0B1220',
  surface: '#1E293B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  divider: 'rgba(241, 245, 249, 0.10)',

  accent: '#3B82F6',
  accent2: '#60A5FA',

  neutral100: '#F1F5F9',
  neutral200: '#E2E8F0',
  neutral300: '#CBD5E1',
  neutral400: '#94A3B8',
  neutral500: '#64748B',
  neutral600: '#475569',
  neutral700: '#334155',
  neutral800: '#1E293B',
  neutral900: '#0F172A',

  accent100: '#DBEAFE',
  accent200: '#BFDBFE',
  accent300: '#93C5FD',
  accent400: '#60A5FA',
  accent500: '#3B82F6',
  accent600: '#2563EB',
  accent700: '#1D4ED8',
  accent800: '#1E40AF',
  accent900: '#1E3A8A',

  danger: '#F87171',
  success: '#34D399',
};

// Light ground.
export const lightPalette: Colors = {
  bg: '#FFFFFF',
  bgDeep: '#E4ECFC',
  surface: '#F1F5FD',
  text: '#0F172A',
  textMuted: '#475569',
  divider: '#E4ECFC',

  accent: '#2563EB',
  accent2: '#6366F1',

  neutral100: '#0F172A',
  neutral200: '#1E293B',
  neutral300: '#334155',
  neutral400: '#475569',
  neutral500: '#64748B',
  neutral600: '#94A3B8',
  neutral700: '#CBD5E1',
  neutral800: '#E2E8F0',
  neutral900: '#F1F5F9',

  accent100: '#EAF1FE',
  accent200: '#D6E4FD',
  accent300: '#93C5FD',
  accent400: '#60A5FA',
  accent500: '#2563EB',
  accent600: '#1D4ED8',
  accent700: '#1E40AF',
  accent800: '#1E3A8A',
  accent900: '#172554',

  danger: '#DC2626',
  success: '#059669',
};

/** @deprecated Ground-only alias kept so unmigrated files keep compiling during the phased
 * Hearth 2.0 rollout — always resolves to the dark palette regardless of the active theme mode.
 * Use `useTheme()` for anything that should react to light/dark + the user's accent color. */
export const colors = darkPalette;

export const DEFAULT_ACCENT_HEX = darkPalette.accent;

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Derives a full accent ramp from a single base hex — used both for the fixed default
// (terracotta) and for a user-picked custom accent color. Saturation is read from the input hex
// but clamped to a sane band, and lightness follows a fixed curve per step, so any chosen hue
// (including a manually-typed hex) still produces a coherent, readable ramp against the dark
// background and light text, rather than reproducing whatever lightness the input happened to have.
const RAMP_LIGHTNESS: Record<string, number> = {
  100: 90,
  200: 80,
  300: 68,
  400: 56,
  500: 46,
  600: 38,
  700: 30,
  800: 22,
  900: 15,
};

export function buildAccentRamp(hex: string) {
  const { h, s } = hexToHsl(hex);
  const clampedS = Math.min(78, Math.max(45, s));
  const ramp: Record<string, string> = {};
  for (const [step, l] of Object.entries(RAMP_LIGHTNESS)) {
    ramp[`accent${step}`] = hslToHex(h, clampedS, l);
  }
  return {
    ...ramp,
    accent: ramp.accent500!,
    accent2: hslToHex(h, clampedS, 62),
  } as Pick<Colors, 'accent' | 'accent2' | 'accent100' | 'accent200' | 'accent300' | 'accent400' | 'accent500' | 'accent600' | 'accent700' | 'accent800' | 'accent900'>;
}

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const fontWeight = {
  heading: '600' as const,
  body: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Display font for wordmarks/headers — loaded via expo-font in app/_layout.tsx
// (see useFonts/@expo-google-fonts/poppins). Body text stays on the system font: the
// skill's pairing also names Open Sans for body, but every `fontWeight.X` in this app is a
// numeric RN style applied to the system font, which renders each weight from one font
// file; Open Sans via expo-font ships each weight as a *separate* named family, so making
// it the sitewide body font would mean touching every StyleSheet that sets `fontWeight` to
// also pick the matching Open-Sans-weight family, or every `fontWeight` style silently stops
// doing anything. Not worth that blast radius for a body face that already reads close to
// the system font.
export const fonts = {
  display: 'Poppins_600SemiBold',
} as const;

// Monogram avatar background colors, drawn from the neutral/accent ramps
export const avatarPalette = [
  colors.accent600,
  colors.accent700,
  colors.neutral600,
  colors.neutral700,
  colors.accent800,
  colors.neutral800,
];

export function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
