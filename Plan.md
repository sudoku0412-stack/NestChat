# NestChat — Plan

Two lists: what's shipped, and what's next. For the live "what to do right now" pick-up point,
[HANDOVER.md](HANDOVER.md) is more current than this file day-to-day — this file is the
higher-level roadmap. See [Context.md](Context.md) for the why behind any of this.

## Achieved so far

**Core messaging**
- 1:1 and group chat: text, photo, video, document, GIF, sticker.
- Reply / star / pin / copy / delete-own-message via long-press menu.
- Read receipts, typing indicator, 2-minute message grouping, date chips.
- Chat list: search, filter chips (All/Unread/Groups/Favorites), archive, favorites,
  multi-select bulk actions.
- Contact Info screen: media/links/docs gallery, mute, starred count, per-chat wallpaper.
- Status (WhatsApp-style ephemeral stories): text/photo/video, viewer list.

**Auth & account**
- Self-serve signup: phone number → anonymous auth → onboarding (no real SMS/OTP).
- PIN-based account recovery.
- Self-service account deletion (tombstone pattern — rows are scrubbed, not hard-deleted, so
  foreign keys stay intact).

**End-to-end encryption**
- Phase 0 (native module spike) — done.
- Phase 1 (identity keys, chat keys, key registry) — done.
- Phase 2 (text message encryption) — done and live (`SEND_ENCRYPTED = true`).
- Phase 3 (media encryption: photos/video/docs/GIFs/stickers) — done, verified on a real device.
- Membership-change key rotation (add/remove member rewraps or rotates the chat key) — done.

**WhatsApp-style feature batch**
- Settings menu (Lists, Broadcast, Starred, Account, Privacy, Chats, Appearance, Notifications,
  Storage & data, Help) — done, including real icons + card grouping (was previously wired
  incompletely — screens existed but the intended visual treatment hadn't landed until this was
  caught and fixed).
- Per-category notification preferences + push gating server-side.
- Media auto-download toggle + per-chat storage usage.
- Lists (saved groups) + Broadcast (fan-out via individual E2EE'd DMs, not a group-key scheme).
- Push notification content/routing overhaul: separate webhooks for messages/media/reactions so
  notifications say "Photo"/"GIF"/"X reacted 👍" instead of a generic "Sent an attachment."

**Visual design**
- Full design system twice-over: originally "Nocturne" (per old README), then a from-scratch
  "Hearth" terracotta/cream identity (Phases A–E: theming foundation, shared header/settings
  components, chat thread redesign, chat list redesign, native chrome fixes), then a full re-skin
  to the current blue/indigo "Chat & Messaging App" system.
- User-customizable accent color, ramped consistently across both light and dark grounds.
- Floating oval bottom tab bar with an animated sliding active-tab indicator (replacing the
  previous flat docked tab bar), built as a custom `tabBar` component with a Reanimated-driven
  indicator kept in sync (width + position) via shared values.
- Light/dark/system theme switching, with a `useTheme()` composed hook as the intended long-term
  read path for all screens (see "Not yet done" below — most screens haven't migrated to it yet).

**Engineering hygiene**
- Jest test suite (107 tests / 16 suites) + `tsc --noEmit`, both run via a pre-push hook.
- Multiple rounds of adversarial code review on every non-trivial change (tombstone-deletion
  holes, libsodium AEAD quirks, accessibility parity on custom components, animation desync
  bugs) — this has consistently been how real bugs get caught before they ship.

## Not yet done / open work

**Highest-priority gap: nothing has been verified on a device in a while.**
Every build since the last TestFlight-tested one has stacked up unverified: the WhatsApp
features batch, the full Hearth redesign, the blue/indigo re-skin, the Settings-screen icon fix,
and the floating tab bar. See [HANDOVER.md](HANDOVER.md)'s "Immediate next step" for the exact
on-device checklist. **Archive and TestFlight-test before doing much more net-new feature work —
the unverified pile only gets riskier to untangle the longer it grows.**

**Design system migration**
- ~48 screens still read colors from the legacy, frozen-at-import `colors` alias in
  `lib/theme.ts` instead of the reactive `useTheme()` hook — meaning those screens don't
  correctly follow light/dark mode. This is the root cause behind most "doesn't look right in
  light mode" reports. Migrate screen-by-screen (pattern: keep structural styles in
  `StyleSheet.create`, apply theme colors inline from `useTheme()`), then delete the `colors`
  alias once nothing imports it — `tsc` will flag every remaining holdout as you go.

**End-to-end encryption**
- Phase 4: encrypt live location coordinates and statuses (not yet covered — currently sent in
  the clear).
- Phase 5: iOS Notification Service Extension, so an encrypted message's push notification can
  say something more useful than generic "New message" without the server ever reading plaintext.
- Phase 6: general polish/hardening pass once 4 and 5 land.

**OTA updates**
- `expo-updates` is installed and partially configured (channel created, `app.json` pointed at
  it) but has never actually been used — no `eas update` has ever been run. Either commit to
  finishing this (so future JS-only fixes ship in seconds instead of a full Archive/TestFlight
  round-trip) or explicitly drop the half-finished config so it stops being a source of confusion
  about whether a given fix will "just show up."

**Privacy / scaling gate for going past TestFlight**
- No invite gating: any signed-up account can see every other user's name and phone number.
  Fine for a trusted household on TestFlight; a real problem for a public App Store listing.
  Needs either an invite-code system or scoping "Contacts" to only people you already share a
  chat with, before this app could ever go public.
- Realtime data currently refetches a whole screen's data on any relevant change rather than
  patching individual rows — acceptable at household scale (~15 members), not how this would be
  built for a larger user base. Not urgent unless the scale assumption changes.
- Expired statuses accumulate forever (no automatic cleanup) — an optional `pg_cron` job exists
  in the migrations but has never been enabled.

**Smaller known gaps**
- No account recovery for a lost anonymous-auth session beyond the PIN flow already shipped.
- Video playback fully downloads-and-decrypts before playing (no streaming decrypt) — an
  accepted household-scale tradeoff given `react-native-libsodium` has no `crypto_secretstream`
  on this native build.
- Reply/Star/pinned-message banners don't scroll-to-message on tap yet.

## Suggestions worth considering (not yet decided on)

- **Keep this file and Context.md updated as part of the end-of-session handover ritual**,
  the same way HANDOVER.md already gets updated — otherwise they'll drift stale the same way
  README.md has. A one-line reminder at the bottom of the HANDOVER.md update checklist would work.
- **README.md needs a pass** to catch it up to the current architecture (folder structure,
  design system name, E2EE) — right now a newcomer reading README.md first would get a
  meaningfully outdated picture. Not urgent, but worth doing before ever handing this repo to
  someone who *only* reads README.md.
- **Consider promoting the on-device verification checklist into an actual pre-archive checklist
  file** (e.g. `RELEASE_CHECKLIST.md`) rather than re-deriving it from HANDOVER.md prose each
  time — the checklist itself doesn't change much between releases even though the list of
  *what's unverified* does.
