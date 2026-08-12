# NestChat — "Hearth 2.0" UI revamp (WhatsApp-quality polish)

## Context

The user finds the current UI "robotic" and wants the whole app to feel as polished as
WhatsApp. Two direction decisions were made explicitly by the user:

1. **Refine the existing Hearth identity** (warm terracotta/cream, Fraunces display accents) —
   do NOT clone WhatsApp's teal/green look. The bar is WhatsApp's *execution quality*, not its
   visual language.
2. **Add a true light + dark theme system.** Today the app is dark-only — the "dark mode"
   toggle merely swaps between two near-identical dark browns (`bg #1E1815` vs `bgDeep #171310`).

Exploration findings that explain the "robotic" feel (all verified against source):

- **Read receipts are text** — `· Read` / `· Delivered` appended after the timestamp
  ([MessageBubble.tsx](components/MessageBubble.tsx) line ~133). No checkmark glyphs at all.
- **Timestamps sit outside/below the bubble** as a separate muted line, instead of nestled
  inside the bubble's bottom-right corner like every polished chat app.
- **No date separators** in the thread — messages from different days run together with no
  "Today / Yesterday / March 3" chips.
- **No message grouping** — every message gets the identical bubble shape and the same
  `marginVertical: space[1]` regardless of whether the same sender sent 5 in a row.
- **Own bubble is outlined, not filled** — `accent900` fill + 1px `accent` border reads as
  wireframe. Other bubble is flat `surface`.
- **Unread badge is a rounded square** (`radius.sm` = 6), not a circle/pill.
- **Unicode glyphs mixed with SVG icons** — `‹` back, `↑` send, `＋` new chat, `✕` close,
  `♪/♪̸` mute, `★` star are font-rendered Text glyphs at inconsistent optical weights, while
  16 other icons are a consistent hand-drawn 1.8-stroke SVG set ([components/icons/index.tsx](NestChat/components/icons/index.tsx)).
- **Send button is a bordered circle containing `↑` text** — not a filled button.
- **Search input has no icon**; swipe actions are text-only colored rectangles.
- **Row dividers everywhere** — 1px hairlines between every chat row and 2px `headerRule`
  under every header, giving the boxed-in "wireframe" look.
- **~20 screens hand-roll the identical header** (`‹` Pressable + centered title + 2px rule) —
  `headerRule` is redefined in 23 files, `back` in 20 files. No shared header component.
- **Only one font weight loaded** (`Fraunces_600SemiBold`); `fontWeight.heading` and `.medium`
  are both `'500'` — no true bold anywhere, flattening all hierarchy.

Assets already in place that the redesign builds on:
- Consistent token sourcing: 51/52 files import from [lib/theme.ts](NestChat/lib/theme.ts) — palette-level
  changes propagate automatically.
- `buildAccentRamp(hex)` (theme.ts:89-118) generates a full accent100–900 ramp from any
  user-picked hex — the light theme can use ramp light-steps and dark theme dark-steps with no
  new machinery.
- Reanimated 4 + gesture-handler already installed and used (tab pill, SwipeableRow, Composer).
- The accent-theming convention is already established: structural props in module-level
  `StyleSheet.create`, colors applied inline (`style={[styles.x, { color: theme.text }]}`) —
  **this is mandatory** because StyleSheet colors are frozen at import time (documented gotcha
  in HANDOVER.md from the accent-color project). The theme system extends this same pattern.

**Constraint carried from project convention:** no local Metro. Verification is
`tsc --noEmit` + `npm test` locally, visual verification via TestFlight build. All changes are
JS-only (no new native deps) — no `expo prebuild` needed; bump build number before archiving.

---

## Phase A — Theme foundation (light + dark)

The load-bearing phase; everything else layers on it.

**[lib/theme.ts](NestChat/lib/theme.ts):**
- Define two named palettes with identical token shape:
  - `darkPalette` — current Hearth values, with tuning: own-bubble fill moves to a filled
    warm tone (drop the border), `surface` may lighten slightly for contrast.
  - `lightPalette` — warm cream ground (`bg ≈ #FAF5EE`), warm white surface (`≈ #FFFDF9`),
    warm near-black text (`≈ #2A2018`), muted `#8A7A6B`, divider `rgba(42,32,24,0.10)`.
    Same `danger`/`success` hues re-tuned for light ground.
- Keep the legacy `colors` export (aliased to `darkPalette`) so unmigrated files keep
  compiling during the phased rollout — remove at the end of Phase E.
- Add `fontWeight.bold: '700'` and make `heading: '600'`; keep Fraunces for the three big
  tab-screen titles only (identity moment), system font everywhere else (same as WhatsApp —
  chat apps read best in the platform font).
- Normalize the `space` scale to round values (`4/8/12/16/24/32`) while keeping the same keys
  so call sites don't change meaningfully.

**[lib/themeMode.tsx](NestChat/lib/themeMode.tsx) — rewrite:**
- Replace the `deepGround` boolean with `mode: 'system' | 'light' | 'dark'` (persisted to
  AsyncStorage under a new key; migrate the old `nestchat.deepGround` value on first read).
- `useTheme()` returns the active palette **merged with the user's accent ramp** (compose with
  the existing `AccentThemeProvider` output so callers get one object: ground + accent).
  Respect `useColorScheme()` when mode is `system`.
- Heed the documented context-memoization gotcha: don't memoize the context value on a deps
  array that omits closed-over state (this exact bug shipped once already — see HANDOVER).

**[app/(app)/appearance.tsx](NestChat/app/(app)/appearance.tsx):** replace the dark-mode Switch with a
three-option System / Light / Dark selector.

**Migration pattern for the ~48 screens/components** (applied progressively in Phases B–E,
not all at once): swap `colors.X` reads that are ground-dependent (bg, surface, text,
textMuted, divider) to `useTheme()` values applied inline; leave structural styles in
`StyleSheet.create`. Static neutrals used decoratively can stay where they're
theme-independent.

## Phase B — Shared chrome + icon completion

- **`components/ScreenHeader.tsx`** (new): back chevron (new `ChevronLeftIcon` SVG), title,
  optional subtitle and right-side actions, no heavy rule underneath (spacing + subtle
  elevation define the boundary instead of the 2px line). Replace the hand-rolled header in
  all ~20 screens. This single component eliminates the largest duplication surface and makes
  every subsequent chrome tweak a one-file change.
- **`components/SettingsRow.tsx`** (new): icon-slot + label + value/chevron/Switch trailing
  slot — adopted by settings.tsx, edit-profile.tsx menu, and all settings sub-screens.
- **Icon set completion** ([components/icons/index.tsx](NestChat/components/icons/index.tsx)) — same 1.8-stroke
  hand-drawn style: `ChevronLeftIcon`, `SearchIcon`, `SendIcon` (filled), `CheckIcon`,
  `DoubleCheckIcon`, `CloseIcon`, `BellIcon`/`BellOffIcon` (replaces `♪/♪̸`), `ArchiveIcon`,
  `HeartIcon`/star-fill for favorite. Purge every Unicode-glyph icon usage (`‹ ↑ ＋ ✕ ♪ ★`)
  across the app.

## Phase C — Chat thread (the hero screen)

[components/MessageBubble.tsx](NestChat/components/MessageBubble.tsx), [app/(app)/chat/[id].tsx](NestChat/app/(app)/chat/[id].tsx),
[components/Composer.tsx](NestChat/components/Composer.tsx), [components/TypingIndicator.tsx](NestChat/components/TypingIndicator.tsx):

- **Bubbles**: filled (no border) — own = accent-tinted fill from the ramp (dark theme:
  deep accent step; light theme: `accent100`-ish), other = surface. Timestamp + receipt move
  **inside** the bubble, bottom-right, small and muted.
- **Read receipts as ticks**: `CheckIcon` (sent/delivered single/double) and `DoubleCheckIcon`
  tinted accent when read — replacing the `· Read` text.
- **Message grouping**: consecutive messages from the same sender within ~2 minutes group —
  tight intra-group gap, larger inter-group gap, tail-corner (the asymmetric small radius)
  only on the group's last bubble, sender name (groups) only on the first.
- **Date separator chips**: centered "Today / Yesterday / 12 August" pills between day
  boundaries in the message list.
- **Composer**: filled circular send button (accent fill, `SendIcon` in contrast color)
  that animates in when text is non-empty (Reanimated scale/fade, matching WhatsApp's
  mic↔send swap feel); input stays a surface pill.
- **Typing indicator**: migrate to Reanimated, dots inside a grouped-style bubble.
- Thread header adopts `ScreenHeader` with avatar + name + last-seen subtitle; wallpaper
  rendering unchanged.

## Phase D — Chat list + tab bar

[components/ChatRow.tsx](NestChat/components/ChatRow.tsx), [app/(app)/(tabs)/index.tsx](NestChat/app/(app)/(tabs)/index.tsx),
[components/SwipeableRow.tsx](NestChat/components/SwipeableRow.tsx), [app/(app)/(tabs)/_layout.tsx](NestChat/app/(app)/(tabs)/_layout.tsx):

- Unread badge → true pill (`radius.full`, min-width with horizontal padding), bold count.
- Remove inter-row hairline dividers; rows separated by spacing; title gets `bold` when
  unread (weight now exists).
- Search bar gains a leading `SearchIcon`; filter chips keep their pattern with softened
  inactive state.
- Swipe actions get icons above short labels (Archive/Favorite/Mute/Delete) instead of
  text-only rectangles.
- Tab bar: keep the pill indicator; icons get filled variants when active (add filled paths
  to the three tab icons); label typography tightened.
- `＋` new-chat glyph → `PlusIcon` in a proper accent-filled FAB-style button (WhatsApp's
  new-chat affordance), positioned bottom-right of the chat list.

## Phase E — Propagation + cleanup

- Adopt `ScreenHeader`/`SettingsRow`/theme tokens across all remaining screens (settings
  suite, group/contact info, members, new-group, lists/broadcast, starred, media gallery,
  archived, status screens, onboarding, login). Mechanical once B exists.
- Modals (`PinModal`, `MessageActionsModal`, `EmojiPickerModal`, pickers): theme-aware
  colors, consistent card radius/elevation.
- `OutlineButton`: add a `filled` primary variant (accent fill) — outline demotes to
  secondary; press feedback gains a subtle scale (Reanimated) instead of opacity-only.
- Avatar: 1px theme-ground ring on stacked group avatars so they separate cleanly.
- Delete the legacy `colors` alias once no file imports it; `tsc` enforces completeness.

## Verification

1. `npx tsc --noEmit` and `npm test` clean after each phase.
2. Existing Jest suites (`lib/theme.test.ts` and others) updated where token values are
   asserted.
3. Visual verification is TestFlight-only (project convention): bump build number, archive,
   verify both themes (device Settings → toggle appearance + in-app selector), the chat
   thread hero flow (send/receive, ticks, grouping, date chips), chat list, and a sweep of
   the settings suite. Accent-color picker must be re-verified in **both** themes since the
   ramp now feeds both.

## Post-approval housekeeping (explicitly requested)

Update [NestChat/HANDOVER.md](NestChat/HANDOVER.md) before any redesign work begins, so a fresh session can
pick up: this session's shipped work (build 5/6, media-encryption AEAD fix, silent-error
fixes, WhatsApp-features batch phases 1–7, code-review findings + fixes), pending Supabase
steps (run migrations 0021–0025, redeploy send-push), and this redesign plan as the next
project with a pointer to this plan file.
