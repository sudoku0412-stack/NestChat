// Design tokens for "Hearth" — a warm terracotta/cream identity approved from a fresh design
// spec (2026-09-14), superseding the blue/indigo "Chat & Messaging App" palette that this file
// previously held (Messenger blue primary, indigo secondary, Poppins display font — see git
// history / HANDOVER.md for that era). This is a NEW Hearth pass, not a revert to the original
// terracotta system from the "Hearth 2.0" sessions — it reuses this file's existing token
// *architecture* (the `Colors` interface, `buildAccentRamp`, the light/dark `Colors` objects)
// but every value below comes from the new spec. Mapping decisions, field by field:
//   - bg          -> spec's bg-canvas (the screen background)
//   - surface     -> spec's bg-surface (cards, bubbles, the composer pill)
//   - bgDeep      -> spec's bg-surface-sunken (recessed wells: icon-tint circles, received
//                    bubbles, switch-off track) — kept as its own field because several existing
//                    call sites already distinguish "surface" from "a step further back", and
//                    bg-surface-sunken is exactly that, not a second background color.
//   - text        -> spec's text-primary
//   - textMuted   -> spec's text-secondary
//   - divider     -> spec's border-subtle
//   - accent/accent2/accentXXX -> spec's accent-primary ramp (still the single hue the app's
//     accent-color picker drives via `buildAccentRamp`; unaffected by a user's custom color)
//   - danger      -> spec's semantic-error
//   - success     -> spec's accent-secondary (sage) — a *ground* token, not part of the
//     user-customizable accent ramp, so "online"/read-receipt-green always reads as sage
//     regardless of the user's chosen brand color. Exactly the role `success` already played
//     for the previous palette's emerald green; sage is Hearth's equivalent "online" color.
//   - highlight (NEW field) -> spec's accent-tertiary (ember gold). No existing field fit this:
//     it isn't part of the customizable accent ramp (same reasoning as `success`/`danger` being
//     fixed ground tokens) and it isn't a second "online" color either — the spec scopes it
//     strictly to the status-ring "has an unviewed status" indicator and one-off highlights.
//     Giving it its own fixed field follows the exact precedent `success`/`danger` set rather
//     than overloading either of them.
//   - neutralXXX  -> regenerated as a warm brown-gray ramp (hue ~30°) instead of the previous
//     cool slate ramp, so one-off uses (switch track-off color, modal scrims, icon-circle fills)
//     read warm rather than clashing with the new palette. Kept the same direction convention
//     the previous ramps used: in each mode, neutral100 sits at the "text" end and neutral900 at
//     the "background" end of that mode's own contrast direction (so neutral100 is dark in light
//     mode but light in dark mode) — call sites that pick a low/high step for contrast keep
//     working unchanged.
// Shape of every export (colors/space/radius/fontWeight/avatarPalette) is kept identical to the
// previous system so existing screens keep working purely from the new values.

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
  /** Fixed ground token — ember gold, status-ring/highlight use only. See file header comment;
   * deliberately NOT part of the user-customizable accent ramp (same pattern as `success`). */
  highlight: string;
}

// Hearth's own accent-primary hex per mode — kept as named constants because both the palette's
// own accentXXX ramp AND `DEFAULT_ACCENT_HEX` below need the exact spec value, not whatever
// `buildAccentRamp`'s formula happens to produce for step 500.
// Both primaries were darkened from the original spec hexes (dark: #E08652, light: #C4622D) in
// the a11y fix pass below — same hue, lower lightness — because sent-message bubbles and
// send/button fills always render WHITE text/icons on top of `accent` (see MessageBubble.tsx's
// `sentTextColor` and Composer.tsx's SendIcon), and the original values landed at 2.73:1 (dark)
// and 4.10:1 (light) against white, both failing WCAG AA's 4.5:1 for normal text. New values
// clear 4.5:1 with a safety margin (contrast math below); see HANDOVER/AGENTS notes for the audit.
//   DARK_ACCENT_PRIMARY:  #E08652 (h≈22°, s≈70%, l=60%) -> #AD531F (h≈22°, s≈70%, l=40%)
//     white-on-bg contrast: 2.73:1 -> 5.21:1
//   LIGHT_ACCENT_PRIMARY: #C4622D (h≈21°, s≈63%, l=47%) -> #AA5527 (h≈21°, s≈63%, l=41%)
//     white-on-bg contrast: 4.10:1 -> 5.20:1
// `accent2` (dark: #EC9A6A, light: #A84F21) is NOT touched: it fails the same white-text
// contrast check in isolation (2.24:1 dark) but a repo-wide search found no call site that
// actually renders white text/icons on an accent2 fill (Composer.tsx's SendIcon and sent-bubble
// text both use `accent`, not `accent2`) -- it's only ever used as a hover-state ramp value today,
// so it isn't the thing failing the audit. Revisit if a future call site puts white content on it.
const DARK_ACCENT_PRIMARY = '#AD531F';
const LIGHT_ACCENT_PRIMARY = '#AA5527';

// Derives a full accent ramp from a single base hex — used both for the fixed default
// (terracotta) and for a user-picked custom accent color. Saturation is read from the input hex
// but clamped to a sane band, and lightness follows a fixed curve per step, so any chosen hue
// (including a manually-typed hex) still produces a coherent, readable ramp against the dark
// background and light text, rather than reproducing whatever lightness the input happened to have.
// Declared here, before `darkPalette`/`lightPalette`, because those object literals call
// `buildAccentRamp` at module-evaluation time (via the `...buildAccentRamp(...)` spread below) —
// this constant and the function must exist before that point in the file, not after.
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

// Dark ground.
export const darkPalette: Colors = {
  bg: '#181410',
  bgDeep: '#2C241D',
  surface: '#221C17',
  text: '#F3ECE3',
  textMuted: '#B3A692',
  divider: '#3A3128',

  // Warm brown-gray ramp, text end (100) -> background end (900) — see file header comment.
  neutral100: '#F3ECE3',
  neutral200: '#E0D6C8',
  neutral300: '#C4B8A6',
  neutral400: '#A89A85',
  neutral500: '#8C7F6C',
  neutral600: '#6E6355',
  neutral700: '#524940',
  neutral800: '#362F29',
  neutral900: '#1F1A16',

  // accent/accent2/accentXXX all come from buildAccentRamp so the ramp math stays the single
  // source of truth; accent/accent2 are then pinned to the spec's exact primary/hover hexes
  // (buildAccentRamp's own step-500/62%-lightness outputs are close but not guaranteed to be
  // bit-identical to the spec's hand-picked values).
  ...buildAccentRamp(DARK_ACCENT_PRIMARY),
  accent: DARK_ACCENT_PRIMARY,
  accent2: '#EC9A6A', // accent-primary-hover

  danger: '#E2695F',
  success: '#5FA391', // accent-secondary (sage) — fixed "online" ground color
  highlight: '#E8BC5C', // accent-tertiary (ember gold)
};

// Light ground.
export const lightPalette: Colors = {
  bg: '#FBF7F2',
  bgDeep: '#F3ECE3',
  surface: '#FFFFFF',
  text: '#2B2420',
  // Darkened from #7A6F63 (a11y fix pass) -- that value sat right at ~4.52-4.60:1 against `bg`
  // (#FBF7F2), effectively on the WCAG AA 4.5:1 line with no safety margin. This nudges to
  // ~5.03:1 (same hue/near-neutral warm brown-gray, lightness only) while staying visibly
  // secondary/muted relative to `text` (#2B2420).
  textMuted: '#73695E',
  divider: '#E7DDD0',

  // Warm brown-gray ramp, text end (100) -> background end (900) — see file header comment.
  neutral100: '#2C2622',
  neutral200: '#453D37',
  neutral300: '#5E554D',
  neutral400: '#786E64',
  neutral500: '#93887C',
  neutral600: '#AFA396',
  neutral700: '#CBC0B2',
  neutral800: '#E4DCD0',
  neutral900: '#F7F2EB',

  // See the matching comment in darkPalette above for why accent/accent2 are pinned after the
  // ramp spread.
  ...buildAccentRamp(LIGHT_ACCENT_PRIMARY),
  accent: LIGHT_ACCENT_PRIMARY,
  accent2: '#A84F21', // accent-primary-hover

  danger: '#C0433B',
  success: '#3E7C6B', // accent-secondary (sage) — fixed "online" ground color
  highlight: '#D9A441', // accent-tertiary (ember gold)
};

/** @deprecated Ground-only alias kept so unmigrated files keep compiling during the phased
 * useTheme() rollout — always resolves to the dark palette regardless of the active theme mode.
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

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
} as const;

export const radius = {
  sm: 10,
  md: 18,
  lg: 24,
  full: 999,
  /** @deprecated Hearth's scale collapses the old sm/md/lg/xl/full set down to sm/md/lg/full —
   * kept as an alias of `lg` (same value, 24) purely so the handful of call sites that still
   * write `radius.xl` (bubble/pill corner rounding) keep compiling and rendering identically.
   * Prefer `radius.lg` in any new or migrated code. */
  xl: 24,
} as const;

export const fontWeight = {
  heading: '600' as const,
  body: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Display font for wordmarks/headers — loaded via expo-font in app/_layout.tsx (see
// useFonts/@expo-google-fonts/fraunces). Body text stays on the system font, for the same reason
// the previous two identities (Fraunces-era Hearth, then Poppins/Open-Sans-era "Chat & Messaging
// App") both made this call: every `fontWeight.X` in this app is a numeric RN style applied to
// the system font, which renders each weight dynamically from one font file. An expo-font-loaded
// family (Fraunces, Open Sans, Inter — this tradeoff is identical across all three) ships each
// weight as a *separate* named family, so making any of them the sitewide body font would mean
// either touching every StyleSheet that sets `fontWeight` to also pick the matching per-weight
// family, or accepting that `fontWeight` silently stops doing anything everywhere it's used.
// Not worth that blast radius for a body face that already reads close to the system font on
// iOS. Same call as before, re-affirmed for this pass rather than mechanically forced otherwise.
export const fonts = {
  display: 'Fraunces_600SemiBold',
} as const;

// Monogram avatar background colors — a distinct 6-hue "household member" palette for per-member
// color coding in group threads, deliberately NOT reusing the accent ramp (so a member's avatar
// color doesn't shift/collide when the household changes its app accent color). Six warm,
// legible hues chosen to read clearly against both the dark (#181410) and light (#FBF7F2)
// canvas, with enough hue separation to tell members apart at a glance: terracotta, ember gold,
// sage, a muted plum, a dusty blue, and a warm clay-rose. All picked at a mid lightness/
// saturation band so white avatar-initials text stays legible on every one.
export const avatarPalette = [
  '#C4622D', // terracotta
  '#B8863A', // ember gold, deepened for contrast with white text
  '#3E7C6B', // sage
  '#8B5A7C', // muted plum
  '#4F7A94', // dusty blue
  '#A85D52', // warm clay-rose
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
