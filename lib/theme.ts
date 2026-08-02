// Design tokens ported from the Nocturne design system (_ds/nocturne/styles.css)
// bound to the NestChat design handoff. Source of truth: styles.css token values.

export const colors = {
  bg: '#161826',
  bgDeep: '#0f1120', // second dark depth for the Settings "dark mode" stand-in toggle
  surface: '#232532',
  text: '#e9e9ed',
  textMuted: '#9397ab',
  divider: 'rgba(233, 233, 237, 0.16)',

  accent: '#9184d9',
  accent2: '#a7a1db',

  neutral100: '#f3f5fe',
  neutral200: '#e4e7f5',
  neutral300: '#cfd3e5',
  neutral400: '#b2b6ca',
  neutral500: '#9397ab',
  neutral600: '#75798c',
  neutral700: '#595d6c',
  neutral800: '#3f424d',
  neutral900: '#292b31',

  accent100: '#f5f4ff',
  accent200: '#e7e5fe',
  accent300: '#d2cefd',
  accent400: '#b5abfc',
  accent500: '#968ae0',
  accent600: '#796cbf',
  accent700: '#5d5294',
  accent800: '#423a6a',
  accent900: '#2b2741',

  danger: '#e0685f',
  success: '#7fbf8f',
} as const;

export const space = {
  1: 2.8,
  2: 5.6,
  3: 8.4,
  4: 11.2,
  6: 16.8,
  8: 22.4,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
  xl: 18,
  full: 999,
} as const;

export const fontWeight = {
  heading: '500' as const,
  body: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
};

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
