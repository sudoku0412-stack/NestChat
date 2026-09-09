# NestChat — Project Context

Read this first if you're picking up this codebase cold (a new AI session, a new developer,
or resuming after a break). It explains what the app is, why it's built the way it is, and where
the real documentation lives. For day-to-day pickup (what's broken, what to do next), read
[HANDOVER.md](HANDOVER.md) — it's updated at the end of every work session and is the most
current source of truth. This file is the stable "what and why," HANDOVER.md is the "where we
left off."

## What this is

**NestChat** is a private, household-only messaging app — WhatsApp/Signal-style chat, but scoped
to one household (family, roommates) instead of the general public. One person builds and
maintains it for their own household; there is no multi-tenant "sign up your own household"
flow, no admin dashboard for managing multiple groups, no App Store public listing (see
"Why TestFlight, not public App Store" below).

- **Platform**: iOS-first (native app via Expo), tested exclusively through TestFlight (see
  "How this app is tested" below — this is a load-bearing constraint on how you should work with
  this repo).
- **Stack**: Expo (React Native + TypeScript), Supabase (Postgres + Auth + Storage + Realtime +
  Edge Functions).
- **Scale**: designed for a single household, roughly 2–15 members. Several architectural
  choices (RLS policies, realtime refetch-on-change instead of patching, no pagination on most
  lists) are deliberately household-scale, not "designed to scale to millions of users."

## Core product surface

- **Chats**: 1:1 and group messaging. Text, photo, video, document, GIF, sticker. Reply, star,
  pin, copy, delete-own-message via a WhatsApp-style long-press menu. Read receipts (double-tick,
  accent-tinted when read), typing indicator, message grouping by 2-minute windows, date chips.
- **Status**: WhatsApp-style ephemeral text/photo/video stories with a viewer list.
- **Contacts / household roster**: every signed-up user is a "household member" — there's no
  separate contacts import; the roster *is* the user list (see the open privacy gap under
  "Known limitations" for why this doesn't generalize past a trusted household).
- **Settings**: profile, appearance (light/dark/system + user-customizable accent color),
  privacy (read-receipt opt-out, presence), notifications (per-category), chats settings,
  storage & data (media auto-download, per-chat usage), Lists (saved groups of people for
  quick actions), Broadcast (send one message to many, delivered as normal per-recipient DMs so
  E2EE keys never have to span more than 2 parties), starred messages, account deletion.
- **End-to-end encryption (E2EE)**: messages, media are encrypted client-side, static per-chat
  symmetric key wrapped per-member via X25519 `crypto_box_seal`. Not Signal/Double-Ratchet —
  deliberately no forward secrecy (see "Why E2EE without forward secrecy" below). Live location
  and statuses are **not yet encrypted** — see [Plan.md](Plan.md).

## Why this app exists / product philosophy

This is a **personal-scale, trust-model-first product**, not a startup building for strangers.
The recurring design principle across the whole codebase: *within* the household, trust is
already high (these are people who live together), so friction that a public messaging app would
need (invite codes, phone verification, per-user blocking, moderation) is deliberately skipped.
*Between* the household and the outside world, privacy still matters a lot — hence full E2EE,
hence TestFlight-only distribution instead of a public App Store listing.

If you're an AI picking this up and tempted to "fix" something by adding a feature that assumes
a larger, less-trusted user base (rate limiting between members, blocking one household member
from another, admin moderation tools) — stop and check whether that's actually wanted. It usually
isn't. Household members removing each other, seeing each other's names/phone numbers, and
rewrapping each other's chat keys on request are all *intentional* trust-model choices, not
oversights.

### Why E2EE without forward secrecy

The user explicitly asked for "WhatsApp-style E2EE, let it be multi-day, let's do it properly,"
and a full phased plan was built and largely executed (see [HANDOVER.md](HANDOVER.md)'s E2EE
section for exact phase status). The protocol choice — a static per-chat symmetric key instead
of Signal's Double Ratchet — is deliberate, not a shortcut:

- One device per user, PIN-era product expectations (no "verify this device" flows), and a
  household trust model make session-state ratcheting protocols pure downside: more complexity,
  more ways to lose message history, no real security benefit given the threat model (the server
  operator/network, not other household members, is who E2EE protects against here).
- Losing a device means losing history for that chat *unless* a co-member's app is online to
  rewrap the chat key for the new device ("social recovery"). If every member reinstalls at once,
  that chat's history is gone for good. This is a known, accepted tradeoff, not a bug.
- Reaction emojis stay plaintext on purpose — keeps push notifications informative ("👍 to your
  message") and an emoji on unreadable content leaks essentially nothing.

### Why TestFlight, not public App Store

The data model has **no invite gating or per-user visibility scoping** — any authenticated user
can see every other user's name and phone number (`users_select_all` RLS), and anyone can sign up
with any unverified phone number. Fine for TestFlight (only people explicitly invited by email can
install it), a real privacy problem on a public listing. Fixing this (invite codes, or scoping
"Contacts" to only people you share a chat with) is a prerequisite for ever going public — see
[Plan.md](Plan.md).

## How this app is tested — the single most important operational fact

**The user tests exclusively via TestFlight, never a local dev client connected to Metro, and
has explicitly asked that Metro never be run for this project.** Concretely:

- JS-only changes are **not** automatically visible to the user. TestFlight installs a fixed JS
  bundle at build time (OTA/`expo-updates` is partially configured but has never been used to
  actually publish an update — see HANDOVER.md). Every change, JS-only or native, currently
  needs: bump build number → (if a native dependency changed) `expo prebuild -p ios` → Xcode
  Archive → Distribute App → App Store Connect → wait for processing → reinstall on-device.
- **Never tell the user "just reload."** An AI assistant did this once and it cost real debugging
  time chasing a "broken" feature that was actually correct code sitting in an old, un-rebuilt
  build.
- Verification for an AI working on this repo means: `npx tsc --noEmit` and `npm test` (Jest),
  never `npx expo start`. Anything that needs an actual device/simulator check is the user's job,
  and the assistant should say so explicitly rather than claiming a UI change "works."

## Architecture map

```
app/                         Expo Router routes
  login.tsx                    Phone entry (anonymous auth, no real OTP)
  onboarding.tsx                First-login setup (name/photo/email; generates E2EE identity keys)
  (app)/                        Authenticated stack
    (tabs)/                       Status / Chats / Settings — floating oval bottom tab bar
    chat/[id].tsx                  Thread (1:1 or group), E2EE encrypt/decrypt on send/read
    edit-profile.tsx                Profile fields + full settings menu (WhatsApp-style)
    account.tsx, privacy.tsx, chats-settings.tsx, appearance.tsx,
    notification-settings.tsx, storage-and-data.tsx, lists.tsx, list-edit/[id].tsx,
    broadcast.tsx, starred-messages/, group-info/[id].tsx, contact-info/,
    media-viewer.tsx, media-gallery/[chatId].tsx, archived-chats.tsx, members.tsx, new-group.tsx
components/                  Reusable UI — icons/ (custom SVG set), MessageBubble, ChatRow,
                              Composer, ScreenHeader, SettingsRow/SettingsCard, FloatingTabBar, ...
lib/
  auth.tsx                    Auth context: session, profile, E2EE init/wipe on login/logout
  theme.ts, themeMode.tsx      Design tokens (light/dark palettes) + useTheme() composed hook
  accentTheme.tsx              User-customizable accent color, ramped across both palettes
  crypto/                      keys.ts, chatKeys.ts, message.ts, media.ts, envelope.ts,
                                registry.ts, decryptRow.ts, mediaCache.ts — the whole E2EE stack
  chatActions.ts, media.ts, broadcast.ts, giphy.ts, notifications.ts, liveLocation.ts, ...
  hooks/                      useMessages, useChatList, useDecryptedMediaUri, ...
supabase/
  migrations/                 25 SQL migrations, run in order via SQL Editor (not CLI-tracked —
                               see HANDOVER.md for why `supabase migration list` is unreliable here)
  functions/send-push/         Edge Function: push notifications for messages/media/reactions
```

## Design system

Currently a **blue/indigo "Chat & Messaging App" palette** (`lib/theme.ts`): Messenger blue
`#2563EB`/`#3B82F6`, indigo secondary, Poppins for a few display moments (tab-root titles),
system font everywhere else. This is the *third* visual identity this codebase has had (originally
"Nocturne" per the old README, then "Hearth" terracotta, now this blue/indigo system) — the
README.md in this repo is **stale** on this point and on the folder structure (it predates the
`(tabs)` group and most Settings screens); treat [HANDOVER.md](HANDOVER.md) as authoritative over
README.md wherever they disagree, and update README.md if you have a session to spare for it.

Key pattern to know before touching any color-related style: colors inside a module-level
`StyleSheet.create({...})` are frozen at import time and won't react to theme/accent changes —
only inline `style={[...]}` overrides read live from `useTheme()`/`useAccentTheme()`. This has
caused real, shipped bugs more than once. See HANDOVER.md's "Gotchas hit across sessions" for the
full list of sharp edges (libsodium's `additional_data` string requirement, `expo prebuild`
wiping build numbers, tombstone-deletion blast radius, etc.) — that section is dense and worth
reading in full before doing E2EE, deletion, or theming work.

## Where to look for what

| Question | Where |
|---|---|
| What's broken right now / what to do next | [HANDOVER.md](HANDOVER.md) |
| What's been achieved / what's planned | [Plan.md](Plan.md) |
| How to set up Supabase, env vars, push notifications | [README.md](README.md) (mostly accurate for *setup*, stale on architecture/design) |
| Full E2EE design rationale and phase plan | HANDOVER.md's "End-to-end encryption" section |
| Recurring bugs/sharp edges across sessions | HANDOVER.md's "Gotchas hit across sessions" section |
