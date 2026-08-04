// "Hearth" design tokens — warm, tactile palette (terracotta/clay accent, cream text,
// warm-brown darks) replacing the earlier cool-blurple "Nocturne" system. Shape of every
// export (colors/space/radius/fontWeight/avatarPalette) is kept identical to Nocturne so
// existing screens keep working purely from the new values — only `fonts` is new.

export const colors = {
  bg: '#1E1815',
  bgDeep: '#171310', // second dark depth for the Settings "dark mode" stand-in toggle
  surface: '#2A231E',
  text: '#F2E9DE',
  textMuted: '#A89A8C',
  divider: 'rgba(242, 233, 222, 0.14)',

  accent: '#D97B4F',
  accent2: '#E8B368',

  neutral100: '#F5EDE3',
  neutral200: '#E8DDD0',
  neutral300: '#D6C7B8',
  neutral400: '#B9A793',
  neutral500: '#A89A8C',
  neutral600: '#8A7A6B',
  neutral700: '#6B5D50',
  neutral800: '#4A4038',
  neutral900: '#332B25',

  accent100: '#FBEAE0',
  accent200: '#F5D3BE',
  accent300: '#EDB48F',
  accent400: '#E39868',
  accent500: '#D97B4F',
  accent600: '#BC623A',
  accent700: '#954C2D',
  accent800: '#6E3820',
  accent900: '#482514',

  danger: '#C0523F',
  success: '#7A9B72',
} as const;

export type Colors = typeof colors;

export const DEFAULT_ACCENT_HEX = colors.accent;

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
  1: 2.8,
  2: 5.6,
  3: 8.4,
  4: 11.2,
  6: 16.8,
  8: 22.4,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const fontWeight = {
  heading: '500' as const,
  body: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
};

// Display font for wordmarks/headers — loaded via expo-font in app/_layout.tsx
// (see useFonts/@expo-google-fonts/fraunces). Body text stays on the system font.
export const fonts = {
  display: 'Fraunces_600SemiBold',
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
