# NestChat — Handover

Last updated: 2026-08-04 (end of session)

## What this is

Private household messaging app. Expo (React Native + TypeScript) + Supabase (Auth, Postgres,
Storage, Realtime). Full feature/setup docs are in [README.md](README.md) — read that first for
anything about running the app, Supabase setup, or design decisions. This file is for picking up
mid-stream: current state, what's broken/pending, what to check first.

## How the user actually tests this — read before assuming anything about "reload"

**The user tests exclusively via TestFlight, not a dev client connected to Metro, and has
explicitly asked that Metro never be run for this project.** This means:

- **JS-only changes are NOT automatically visible.** TestFlight installs a fixed JS bundle at
  build time. Unless/until OTA (`expo-updates`, already installed but not fully wired to actually
  publish updates — see below) is set up and actually used, *every* change — JS-only or
  native — needs a fresh `expo prebuild -p ios` (only if a native dependency changed) → Xcode
  Archive → Distribute App → App Store Connect → wait for TestFlight processing → reinstall.
- Don't tell the user "just reload, no rebuild needed" for JS-only changes — that assumption
  caused real confusion this session (the custom theme-color feature appeared completely broken
  for several turns; it was actually working code sitting in an old, un-rebuilt TestFlight build).
  Always bump the build number and say a fresh archive is needed, unless OTA is confirmed live.
- **OTA status**: `expo-updates` is installed, `app.json` has `runtimeVersion.policy: "fingerprint"`
  and an `updates.url` + `requestHeaders.expo-channel-name: "production"` pointing at an EAS
  Update channel (`production`) that was created (`eas channel:create production`), but **no
  build has ever actually been confirmed running with OTA live**, and `eas update` has never been
  run to publish anything. If picking this up, either commit to finishing that setup (so future
  JS-only fixes ship in seconds via `eas update`) or explicitly tell the user it's still
  archive-every-time and drop the half-finished OTA config to avoid confusion.

## Current state

- Repo: https://github.com/sudoku0412-stack/NestChat (private)
- Supabase project: `sudoku0412-stack's Org / NestChat` (project ref `hfmjigdtmjbgyqcnneqt`)
- **App version 2.0.0, build 4** (`app.json` / `ios/NestChat.xcodeproj` / `ios/NestChat/Info.plist`
  — all three must stay in sync; see the recurring gotcha below about `expo prebuild` wiping the
  build number back down). **Build 4 has not yet been archived/uploaded** — that's the immediate
  next step, see below.
- All of this session's work (commit `7001938`, "Hearth redesign, PIN account recovery, chat
  overhaul, accent theming") is **committed and pushed to `origin/master`** as of 2026-08-04. Tests
  (79/79) and `tsc --noEmit` were clean at push time.
- Auth: **anonymous auth + typed-in phone number**, not real OTP, now with **PIN-based account
  recovery** (migrations `0006`–`0008`) so signing out or reinstalling doesn't lose your identity
  — see "This session's work" below for the full story of why that took 3 migrations to get right.
- **13 migrations total** (`0001`–`0013`), all already run against the live Supabase project by the
  user. If resuming from a git checkout on a different machine, diff `supabase/migrations/` against
  what's actually live before assuming anything is applied.
- Design system is **"Hearth"** (`lib/theme.ts`) — warm terracotta/cream palette, Fraunces serif
  display font, replacing an earlier cool-blurple "Nocturne" system. **The accent color is now
  user-customizable** (Settings → App theme color) via `lib/accentTheme.tsx`'s
  `AccentThemeProvider`/`useAccentTheme()` — see the important pattern note below before touching
  any color-related style.
- Navigation: three tabs (Status / Chats / Settings) with a custom animated pill indicator and SVG
  line icons (`components/icons/`). Chats tab now has search, filter chips (All/Unread/Groups/
  Favorites), a real Archived view (`app/(app)/archived-chats.tsx`), and long-press multi-select
  with bulk mute/archive/delete.
- Chat threads support: **Star** (private, per-user), **Pin** (shared, one per chat, banner at top
  of thread), **Reply** (quotes a message inline), **Copy**, **Delete own message** — all via a
  WhatsApp-style long-press card menu (`components/MessageActionsModal.tsx`). "Report" and "Add to
  contacts" were deliberately *not* copied from WhatsApp's menu — no moderation backend exists for
  Report, and "Add to contacts" was reinterpreted as **View contact** (opens the existing Contact
  Info screen) since everyone's already a known household member.
- Contact Info screen (tap a 1:1 chat's header) has: media/links/docs gallery, mute toggle,
  starred-messages count, **custom per-user-per-chat photo wallpaper**, "create group with this
  person," and "clear chat" (hides messages from your view only — never deletes the other side's
  copy).
- **Jest test suite** (`npm test`, 79 tests / 9 suites, all passing as of this session) + `npx tsc
  --noEmit`. A husky pre-push hook runs both before every `git push`. Neither covers
  native/device-only behavior — that still needs manual on-device QA, which for this project means
  a TestFlight round-trip (see above).

## Immediate next step for whoever picks this up

1. **Archive and upload build 4.** Push Notifications capability confirmed re-added in Xcode
   (Signing & Capabilities) as of 2026-08-04. Next: Product → Archive → Distribute App → App Store
   Connect.
2. Once installed, **verify the App theme color picker actually works** (Settings → App theme
   color → drag hue slider or type a hex → Save). This was broken all session due to a stale-closure
   bug in `lib/accentTheme.tsx` (fixed, see gotchas below) — confirm the fix actually landed rather
   than assuming.
3. Decide on the **OTA setup** question above — finish it or drop it, don't leave it half-done.
4. Original TestFlight distribution setup (External Testing group, Beta App Review) — this was
   completed in an earlier session; if starting fresh on a new Apple account this whole section
   would need redoing. See git history / this file's own history for the original steps if needed.

### Why TestFlight, not public App Store

This app's data model has **no invite gating or per-user visibility scoping** —
`users_select_all` RLS lets any authenticated user see every other user's name and phone number,
and anyone can sign up with any unverified phone number. That's fine for TestFlight (only people
you explicitly invite by email can even install it), but would be a real privacy problem on a
public App Store listing. If this ever needs to go fully public, that gap needs fixing first
(invite codes, or scoping "Contacts" to only people you actually share a chat with).

## Known rough edges (not bugs, just unfinished/tradeoffs)

- No SMS OTP — signup is open, not invite-gated, mitigated (not eliminated) by PIN-based recovery.
- Live location sharing asks for "Always" location permission — invasive; worth revisiting.
- Expired statuses aren't cleaned up automatically (optional `pg_cron` snippet in `0003_status.sql`).
- No in-app account deletion flow. Apple requires this (Guideline 5.1.1v) before any public listing.
- Reply/Star/pinned-message banners don't scroll-to-message on tap — acceptable v1 limitation, not
  a bug.
- Full list of build-vs-prototype deviations is in README's "Design notes & deviations" section.

## This session's work (2026-08-03/04) — large session, quick summary

In rough order: PIN-based account recovery (3 follow-up migrations to get the merge-on-recovery
logic and no-pin-yet self-service path correct) → full "Hearth" visual redesign (palette, Fraunces
font, SVG icon set, tab bar, redesigned attach-menu drawer — went through 3 iterations: Modal
sheet → Reanimated-height drawer → `LayoutAnimation`-driven drawer, chasing a real jank bug caused
by animating layout height on the UI thread instead of using transforms) → chat-list overhaul
(search/filters/archive/favorites/multi-select) → Contact Info screen + per-chat wallpaper → Star
messages → Reply/Pin/Copy/Delete via a proper long-press menu (redesigned twice to match a
WhatsApp reference screenshot's icon-left layout and tap-anchored position) → user-customizable
accent color (the biggest single piece — required auditing every `colors.accent*` usage across
~20 files to find which were frozen in module-level `StyleSheet.create` calls vs. already
reactive, then splitting each frozen one into static-structure + inline-color-override).

## Gotchas hit this session, if they recur

- **The user tests via TestFlight only — see the dedicated section at the top of this file.** This
  caused the single biggest time-sink of the session (theme color appearing "completely broken"
  for many turns when the actual bug was a one-line fix, just never reaching the device).
- **Context `useMemo` deps must include every closure the memoized value exposes, not just the
  values that look like they'd change.** `lib/accentTheme.tsx`'s context value was memoized on
  `[themedColors, accentHex]`, but also exposed `setAccentColor`, which closes over `profile`.
  `profile` can go from `null` → loaded without `accentHex`'s *value* changing (e.g. it's still
  the same default string before and after). React correctly skipped recomputing the memo, so
  `setAccentColor` stayed permanently bound to `profile = null` from the provider's first render,
  forever. Fixed by just not memoizing that particular object (it's cheap to build). If adding any
  other context that wraps a function closing over frequently-changing state, either include every
  closed-over value in the deps array or don't memoize the wrapper object at all.
- **Style colors used inside a module-level `StyleSheet.create({...})` call are frozen at import
  time and won't react to a runtime theme/context change** — only inline `style={[...]}` overrides
  or values read inside a component function body are reactive. This is *the* pattern for
  `useAccentTheme()`: keep structural properties (padding, radius, border widths) in the static
  `StyleSheet.create`, and apply any accent-dependent color as `style={[styles.x, { color:
  accentColors.accent }]}` from inside the component. Forgetting this for a new accent-colored
  element anywhere in the app is the most likely regression path going forward.
- **Postgres `create or replace function` cannot change a function's return-table column list** —
  had to `drop function if exists` before `create function` when adding a `favorite` column to
  `get_chat_list()`'s return type (migration `0010`). Same applies to any future RPC signature
  change that adds/removes/reorders returned columns.
- **PIN-recovery's account-merge must reassign every FK'd row (`chats`, `messages`,
  `chat_members`, `message_reads`, `statuses`, `status_views`, `live_locations`) *before* deleting
  the old `auth.users` row**, and must set the new row's `phone` *after* that delete, not before —
  the old row still holds the unique `phone` value until it's actually gone (migration `0008` was
  a follow-up fix for getting this ordering wrong in `0006`).
- **Never run ad-hoc test/diagnostic scripts against the live Supabase project** (carried over from
  last session — still true, no new incidents this session, but worth repeating).
- **`expo prebuild` wipes, every single time it runs**: the build number (`CURRENT_PROJECT_VERSION`
  in `project.pbxproj` + `CFBundleVersion` in `Info.plist`, both reset to whatever `app.json`
  says — keep `app.json` as source of truth and bump it *before* prebuilding), `UIBackgroundModes`
  in `Info.plist` (trim back to just `location` + `remote-notification`), and the Push
  Notifications capability entry in the Xcode project (must be re-added via Xcode's UI, not by
  hand-editing files). This bit multiple times this session across `expo-clipboard`'s install and
  others — always re-check all three after any `expo prebuild -p ios` run.
- **CocoaPods locale error** — still fixed by `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` prefix, carried
  over from before, no new incidents.
