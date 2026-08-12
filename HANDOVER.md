# NestChat — Handover

Last updated: 2026-08-12 (end of session — E2EE media fix, WhatsApp-style features batch, and
the Hearth 2.0 UI revamp's Phases A–D (+ part of E) all landed and **committed** to `master`
(commits `553571b`..`0b9cc0e`), NOT pushed yet. Build bumped to **7**. Nothing archived to
TestFlight since build 5 — this is the very next thing to do.)

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

## End-to-end encryption (E2EE) — multi-phase project, in progress

User explicitly asked for WhatsApp-style E2EE, "let it be multi-day, let's do it properly." Full
architecture + phased plan is at `~/.claude/plans/dazzling-conjuring-phoenix.md` (also mirrored in
this repo's session transcript) — read that before continuing this work, it has the full
rationale. Key decisions locked in with the user:

- **Strict E2EE, no server key escrow.** Private keys never leave the device. Losing a device (or
  reinstalling) means old messages are unreadable *unless* a co-member's app is online and rewraps
  history for the new device's key ("social recovery") — if every household member reinstalls at
  once, that chat's history is gone for good. This is a deliberate, user-approved tradeoff.
- **Everything gets encrypted eventually**: messages, media, live-location coordinates, statuses.
  Reaction emojis stay plaintext (user-approved — keeps reaction push notifications working, and
  an emoji on unreadable content leaks ~nothing).
- **Protocol**: static per-chat symmetric key (XChaCha20-Poly1305, or AES-256-GCM in tests — see
  below), wrapped per-member via X25519 `crypto_box_seal`. NOT Signal/Double-Ratchet — no forward
  secrecy, deliberately, because PIN-era product expectations + one-device-per-user + household
  trust model make session-state protocols pure downside (see plan doc for the full rationale).

**Progress so far:**

- **Phase 0 (spike) — done.** `react-native-libsodium` + `react-native-keychain` installed,
  `expo prebuild -p ios` + `pod install` succeeded, a full Debug simulator compile
  (`xcodebuild ... build`) succeeded. The top risk (native module doesn't compile on this RN/Expo
  version) is cleared. Runtime perf on real 10MB+ files hasn't been benchmarked yet — that'll
  happen naturally on the first TestFlight build that touches media (Phase 3), not forced locally
  (this project's Metro/TestFlight-only testing convention applies here too).
- **Phase 1 (crypto lib + keys) — done, zero behavior change.** New `lib/crypto/` module:
  `keys.ts` (Keychain-backed X25519 identity keypair, `ensureIdentityKeyPair`/`wipeIdentityKeyPair`),
  `registry.ts` (publishes public key to `users.public_key`), `chatKeys.ts` (`getOrCreateChatKey`,
  `getChatKeyById`, `rewrapChatKeyForMembers`, `rotateChatKeyOnRemoval` — all against new
  `chat_keys`/`chat_key_members` tables), `message.ts` (`encryptMessageText`/`decryptMessageText`,
  AEAD additional-data = `chatId:messageId:senderId:keyId` so ciphertext can't be spliced across
  chats/messages/senders by the server), `envelope.ts` (base64 nonce+ciphertext packing,
  `isEncryptedRow`), `config.ts` (`SEND_ENCRYPTED = false` until Phase 2b). Hooked into
  `app/onboarding.tsx` (key generation blocks `onboarding_completed`) and `lib/auth.tsx`
  (`initializeCrypto` in `loadProfile` — runs on every session load, which is also what
  re-publishes a new public key after a reinstall; `clearCryptoState` on sign-out/cleanup).
  **Migration `0018_e2ee_keys.sql` has NOT been run against the live Supabase project yet** — run
  it before any of this can actually create/wrap a chat key.
- **Phase 2 (text message encryption) — done, `SEND_ENCRYPTED = true`.** `chatActions.ts`'s
  `sendTextMessage` now encrypts (falls back to plaintext only if this device has no identity key
  yet, which shouldn't happen post-onboarding). Reads: `useMessages`/`useChatList`/starred-messages/
  media-viewer all decrypt via a shared cache+helper (`lib/crypto/decryptRow.ts`) so a message
  decrypted once anywhere isn't re-decrypted elsewhere. `get_chat_list()` RPC (migration `0019`)
  now returns the enc columns for the client to decrypt the chat-list preview itself. Membership
  changes rewrap/rotate the chat key: `group-info/[id].tsx` add/remove, `settings.tsx`'s
  `remove_household_member` (snapshots affected chats *before* the RPC deletes the rows, since
  that's the only chance to know which chats need rotating). `new-group.tsx`'s system message now
  goes through `sendTextMessage` instead of a raw insert (was a silent plaintext-leak bypass).
  **⚠️ Rollout risk, read before shipping this build**: every household member must be on this
  build (or newer) before anyone sends a message — an older build renders an encrypted message as
  a **blank bubble** (its `body` is null and it has no idea what `enc_v`/`ciphertext` mean).
  **Two more migrations need running** beyond `0018`: `0019_chat_list_encrypted_preview.sql`
  (drops/recreates `get_chat_list()` — same return-type-change gotcha as `0010`) and
  `0020_notify_send_push_enc_v.sql` (the `messages`-insert trigger function `notify_send_push`
  didn't forward `enc_v` in its payload at all — without this fix the edge function can't tell an
  encrypted text message apart from a media-placeholder row and would silently never notify for
  encrypted messages). `0020` needs the same "paste in the real service-role JWT before running"
  step as `0017` did.
- **Phase 3 (media encryption) — done, no new migration needed** (`message_media.wrapped_key` and
  `messages.key_id` already existed from `0018`). Envelope-encryption design: each file gets its
  own random 32-byte key, encrypted with `lib/crypto/media.ts`'s `encryptFileBuffer` (single-shot
  AEAD over the whole buffer, not streamed — see the `crypto_secretstream` gotcha above), and
  *that* file key is wrapped with the chat's own symmetric key (not per-member -- anyone who
  already has the chat key can unwrap it), stored base64 in `message_media.wrapped_key`. The
  message's own `key_id` column records which chat key did the wrapping, purely so history stays
  decryptable after a key rotation, even though a pure-media message has no text `ciphertext`.
  - `chatActions.sendMediaMessage` rewritten: generates the message id client-side (like
    `sendTextMessage` always has), uploads *before* any DB row exists (nothing to clean up on a
    failed upload — the old flow's placeholder-message-then-delete-on-failure dance is gone), then
    inserts `messages` + `message_media` together.
  - `lib/media.ts` split into `readAssetBytes` / `uploadMediaBytes` so `sendMediaMessage` can slot
    an encryption step in between; `uploadMedia` still exists as a thin wrapper of the two for any
    future plaintext-only caller.
  - New `lib/crypto/mediaCache.ts` + `lib/hooks/useDecryptedMediaUri.ts`: downloads, decrypts, and
    caches to a local file (`expo-file-system`'s new `File`/`Directory` class API, not the
    deprecated string-based one) on first access; legacy plaintext rows (`wrapped_key` null) still
    just get a signed URL, unchanged. `MediaTile`, `media-viewer.tsx`, `media-gallery/[chatId].tsx`
    all swapped from `useSignedUrl` (now dead, deleted) to this hook.
  - Opening a decrypted document needed a new dependency, **`expo-sharing`** (installed this
    session — `expo prebuild -p ios` again, which means re-doing the usual wipe-checklist: build
    number, `UIBackgroundModes`, Push Notifications capability). A decrypted document is a local
    `file://` URI, which `Linking.openURL` doesn't handle; legacy plaintext documents are still a
    remote signed URL, which `Sharing.shareAsync` can't open directly -- both `MediaTile` and
    `media-gallery` branch on the URL's scheme to pick the right one.
  - **Known, accepted UX regression** (per the user's own household-scale tradeoff): videos fully
    download-and-decrypt before playback starts, no streaming decrypt -- same limitation as no
    `crypto_secretstream`.
  - **Verified on a real device (2026-08-12)** — but only after a real bug was found and fixed:
    `react-native-libsodium`'s native binding for `crypto_aead_xchacha20poly1305_ietf_encrypt`/
    `_decrypt` **throws at runtime unless `additional_data` is a string** — passing `null`
    (which the TypeScript types happily accept) fails with "input type not yet implemented".
    `lib/crypto/media.ts`'s two file-content AEAD calls passed `null`; every media send (photo,
    video, doc, GIF, sticker) failed silently until fixed to pass `''`. The key-wrap calls were
    unaffected (they always passed a real AD string). The Jest mock does NOT replicate this
    native quirk, so tests passed throughout — device testing was what caught it.
- **Not started yet**: Phase 4 (live location + statuses), Phase 5 (iOS Notification Service
  Extension so push notifications can still say "sent you a GIF" without the server ever reading
  plaintext — until then, encrypted-message push notifications just say generic "New message"),
  Phase 6 (polish/hardening).

**Gotcha specific to this feature**: `react-native-libsodium`'s exposed API (this version) does
NOT include `crypto_secretstream`/`crypto_pwhash` on native (only "with loadSumoVersion" on web).
No `crypto_pwhash` needed given the no-server-escrow decision. No `crypto_secretstream` means
Phase 3's media encryption should do single-shot AEAD over the whole file buffer (matches the
existing plaintext upload pipeline, which already loads whole files into memory) rather than
true streaming — revise the plan doc's Phase 3 section if picking this up, it still assumes
secretstream.

**Testing note**: `react-native-libsodium`/`react-native-keychain` can't run under Jest (no native
bindings under Node) — `lib/testUtils/libsodiumMock.js` substitutes real-but-different cryptography
(X25519 + AES-256-GCM via Node's builtin `crypto`, instead of X25519 + XChaCha20-Poly1305) so the
*logic* around the primitives (wrap/unwrap, AEAD tamper-detection, envelope packing) gets real
test coverage; it does not validate the actual native library, which Phase 0's device compile did.

## Current state

- Repo: https://github.com/sudoku0412-stack/NestChat (private)
- Supabase project: `sudoku0412-stack's Org / NestChat` (project ref `hfmjigdtmjbgyqcnneqt`)
- **Everything from the 2026-08-12 session is committed and pushed to `origin/master`**
  (`553571b`..`0b9cc0e`) — the media-encryption fix, the WhatsApp features batch + migrations
  `0021`–`0025`, and Hearth 2.0 Phases A–D + part of E, each as its own commit. Tests (107/107)
  and `tsc --noEmit` are clean as of the last commit.
- **App version 2.0.0, build 7** in `app.json`, synced into `ios/NestChat.xcodeproj`
  (`CURRENT_PROJECT_VERSION = 7`) and `ios/NestChat/Info.plist` (`CFBundleVersion = 7`).
  **⚠️ `ios/` is gitignored and untracked** (`git ls-files ios/` returns nothing — checked this
  session, wasn't previously documented here). That means the build-number bump and the
  `UIUserInterfaceStyle` fix (see Hearth 2.0 section below) only exist on *this* machine's local
  checkout; they are not in git and won't survive a re-clone or a different machine. If that's
  ever a problem, either start tracking `ios/` for real or re-apply these edits by hand elsewhere.
  Build 5 was the last one archived and TestFlight-tested (E2EE text + media verified end-to-end
  on device). **Nothing since build 5 has been archived** — the features batch, build 6, and now
  build 7's entire Hearth 2.0 redesign are all still only sitting in a local checkout, never seen
  on a device. **No `expo prebuild` needed** for any of it — everything since build 5's prebuild
  is JS/SQL/plist-only, and the Push Notifications capability the user re-added in Xcode for
  build 5 survives as long as prebuild isn't re-run.
- Auth: **anonymous auth + typed-in phone number**, not real OTP, with **PIN-based account
  recovery** (migrations `0006`–`0008`), and now also **self-service account deletion**
  (tombstone pattern, migrations `0021`/`0025` — see the features-batch section below).
- **25 migrations total** (`0001`–`0025`). `0001`–`0020` are **confirmed live** (verified this
  session via REST checks against the enc tables/columns and by the user pasting the live
  `notify_send_push` body). **`0021`–`0025` exist only locally and have NOT been run** — they
  must be pasted into the Supabase SQL Editor in order before the features batch works
  server-side. None of them need the service-role-JWT dance (unlike `0017`/`0020`). Note the
  CLI's `supabase migration list` shows *nothing* as applied remotely — migrations have always
  been run via SQL Editor paste, so the CLI history table is empty; verify by querying schema,
  not the CLI.
- **`supabase/functions/send-push/index.ts` was modified** (per-user `notify_messages`/
  `notify_media`/`notify_reactions` gating) and needs redeploying:
  `supabase functions deploy send-push` from the repo root (project is linked). Deploy after
  running `0022`, or the function will reference columns that don't exist yet.
- Two Database Webhooks were added this session beyond the original `messages` one:
  `message_media` INSERT and `message_reactions` INSERT+UPDATE, both → the `send-push` edge
  function (found under **Database → Triggers** in the current dashboard UI, not a separate
  "Webhooks" page — that moved/was renamed at some point after this app's original setup).
- **Message reactions** (WhatsApp-style long-press emoji bar, 👍❤️😂😮😢🙏 + a "+" opening a full
  emoji grid via `components/EmojiPickerModal.tsx`) — `supabase/migrations/0014_message_reactions.sql`,
  `lib/chatActions.ts`'s `setMessageReaction`/`clearMessageReaction`, wired through `useMessages`
  and `MessageActionsModal`/`MessageBubble`. The reaction bar and action-list card now anchor to
  whichever side the message bubble is on (own → right edge, other's → left edge) — an earlier
  version always anchored left regardless of `isOwn`, which looked misaligned for every own-message
  long-press.
- **GIF/sticker picker** docks inline where the keyboard would be (`components/GifStickerPanel.tsx`,
  `lib/giphy.ts`), not a bottom-sheet Modal — matches WhatsApp/Telegram's swap-in-place feel. Backed
  by the **Giphy API** (Tenor was the original plan but Tenor stopped onboarding new API clients as
  of Jan 2026 — don't re-try that path). Needs `EXPO_PUBLIC_GIPHY_API_KEY` in `.env` (already set
  locally) and migrations `0015`/`0016` (widen `message_media.kind` to allow `'gif'` and `'sticker'`
  as two *distinct* kinds — same upload pipeline, kept separate purely so notifications/labels can
  say "GIF" vs "Sticker"). Sent as a normal `message_media` row — reuses `lib/media.ts`'s existing
  upload pipeline (fetches the Giphy CDN URL, re-uploads to Supabase Storage) rather than depending
  on Giphy's CDN staying up long-term.
- **Push notification content/routing overhaul** — `supabase/functions/send-push/index.ts` now
  handles three separate Database Webhooks instead of one (`messages` INSERT for text only,
  `message_media` INSERT for photo/video/document/gif/sticker, `message_reactions` INSERT/UPDATE
  for "X reacted 👍 to your message"). **Two new webhooks need to be added in the Supabase
  Dashboard** (`message_media` and `message_reactions` — see README's "Push notifications"
  section for the exact table/event pairs) and the function needs redeploying
  (`supabase functions deploy send-push`) before any of this takes effect. Previously the
  `messages`-only webhook fired before a media message's `message_media` row existed, so every
  photo/video/gif/sticker notification just said "Sent an attachment." Tapping a notification also
  now scrolls straight to the message that triggered it (`app/(app)/chat/[id].tsx`'s
  `scrolledToTargetRef` + `messageId` route param) instead of landing at the bottom of the thread.
- Design system is **"Hearth 2.0"** (`lib/theme.ts`) — warm terracotta/cream palette, Fraunces
  serif display font (now used sparingly — just the three tab-root screen titles + a couple
  identity moments — everything else is system font, per the redesign plan). As of this session
  there are **two ground palettes**, `darkPalette`/`lightPalette`, plus a `mode: 'system'|'light'|
  'dark'` selector (`lib/themeMode.tsx`'s `ThemeModeProvider`) — `useTheme()` is the composed
  result (active ground + the user's accent ramp) and is what any *migrated* screen should read
  from. The legacy `colors` export is a dark-only, frozen-at-import alias kept around so the
  ~48 screens not yet migrated to `useTheme()` keep compiling and rendering (dark-only) — see the
  Hearth 2.0 session bullet and Immediate next step for the migration that's still pending.
  **The accent color is user-customizable** (Settings → App theme color) via `lib/accentTheme.tsx`'s
  `AccentThemeProvider`/`useAccentTheme()` — see the important pattern note below before touching
  any color-related style; the same frozen-alias trap applies to `colors.accentXXX`, not just the
  ground tokens (see the Hearth 2.0 bullet above for a real instance of this bug this session).
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
- **Jest test suite** (`npm test`, **107 tests / 16 suites**, all passing as of 2026-08-12,
  `npx tsc --noEmit` clean) + a husky pre-push hook running both before every `git push`. Neither
  covers native/device-only behavior — that still needs manual on-device QA, which for this
  project means a TestFlight round-trip (see above). E2EE Phases 0–3 **have now been verified
  on-device** (text + all media kinds, 2026-08-12); the features batch's final state has not —
  see Immediate next step.

## Immediate next step for whoever picks this up

1. **Archive build 7 and get it on TestFlight.** No prebuild needed (see Current state). This is
   the single biggest gap right now: builds 6 and 7 — the entire WhatsApp features batch AND the
   entire Hearth 2.0 redesign — have never been seen running on a device. Verify on-device:
   - Both themes: Settings → Appearance → System/Light/Dark, in both directions, plus toggling
     the OS appearance while on "System" mode. Watch the keyboard and any native alert/action
     sheet — `UIUserInterfaceStyle` was just changed from hardcoded "Dark" to "Automatic" in
     `Info.plist`, unverified.
   - Chat thread: send/receive, read ticks (single vs double, accent tint on read), message
     grouping (send several fast messages, then wait >2min and send another — spacing/tail radius
     should visibly change), date chips crossing a real day boundary, Composer's send button
     animating in/out as you type/clear.
   - Chat list: pill unread badges, FAB new-chat button, swipe actions (icon+label), search icon,
     filter chip active state.
   - Accent-color picker in **both** themes now that the ramp feeds both grounds (Settings → App
     theme color) — this is the thing the user specifically asked to confirm still works before
     approving the redesign.
   - Everything from the WhatsApp features batch that was never verified after build 5's install:
     settings menu under Edit profile, account deletion end-to-end, notification toggles actually
     gating pushes, storage totals, media tap-to-download when auto-download is off, Lists CRUD,
     broadcast to 2+ members.
2. **Finish Hearth 2.0 Phase E** if the above looks good. What's done: `OutlineButton`'s `filled`
   variant, `GroupAvatarStack`'s ring, the two native-chrome fixes above. What's NOT done and is
   genuinely the bulk of the remaining work — the plan itself flags this as "mechanical once B
   exists," not small: migrating the ~48 screens still reading the frozen dark-only `colors`
   alias over to `useTheme()` (pattern: structural props stay in `StyleSheet.create`, colors
   applied inline — see any already-migrated screen, e.g. `appearance.tsx`, as the reference), then
   deleting the `colors` alias from `lib/theme.ts` once nothing imports it (`tsc` will flag every
   remaining holdout). Also unfinished: `PinModal`/`MessageActionsModal`/`EmojiPickerModal` weren't
   touched this session (checked — they're already reasonably consistent on radius/elevation, but
   they're also 3 of the ~48 screens still on the frozen `colors` alias).
3. Still parked behind all of the above: **E2EE Phase 4 (live location + statuses encryption)**
   and Phase 5 (notification service extension) — see the E2EE section.

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
- ~~No in-app account deletion flow~~ **Fixed 2026-08-12** — self-service deletion shipped
  (Account → Delete my account; tombstone pattern, migrations `0021`+`0025`), satisfying
  Apple Guideline 5.1.1v once those migrations run.
- Reply/Star/pinned-message banners don't scroll-to-message on tap — acceptable v1 limitation, not
  a bug.
- Full list of build-vs-prototype deviations is in README's "Design notes & deviations" section.

## This session's work (2026-08-12) — quick summary

In rough order:

- **Verified migrations `0018`–`0020` live** (REST probes + user pasting the trigger body) —
  the previous session's open question, now closed.
- **Build 4 → 5**: prebuild (for the Phase-3 native deps), full wipe-checklist re-applied, user
  re-added Push Notifications capability in Xcode and archived. A start-a-chat crash reported on
  the *old* build 4 did not reproduce on build 5 (never root-caused — no crash log available).
- **Media encryption was silently broken on device** — every media send failed. Two-part fix:
  (1) `handlePick`/`handleSelectGif` in `chat/[id].tsx` had `try/finally` with no `catch`, so
  failures showed nothing — added `Alert.alert` error surfacing; (2) that surfaced the real bug,
  the libsodium `additional_data` string requirement (see the E2EE Phase 3 bullet above) — fixed
  in `lib/crypto/media.ts`. User confirmed working on device.
- **WhatsApp-style features batch** (7 phases, planned + executed same session): Settings
  reorganized into a WhatsApp-style menu (initially on the Settings tab, then **moved into
  `edit-profile.tsx`** at the user's request — tapping your own profile row opens profile fields
  + the full menu); new screens `account/appearance/privacy/chats-settings/help/
  notification-settings/storage-and-data/lists/list-edit/[id]/broadcast` + global
  `starred-messages/index.tsx`; **self-service account deletion** (migration `0021`: tombstone
  `_tombstone_user` helper, `delete_own_account` RPC, and a fix for a latent FK-violation bug in
  `remove_household_member` — it hard-deleted `users` rows, which RESTRICTs on
  `messages.sender_id`); **per-category notification prefs** (`0022` + send-push gating);
  **media auto-download toggle + per-chat storage usage** (`0023`; `useDecryptedMediaUri` now
  returns `{url, load}` with an `autoLoad` param); **Lists + Broadcast** (`0024`;
  `lib/broadcast.ts` fans out via `find_or_create_dm` + the existing per-chat E2EE send path —
  recipients just see a normal DM). `sendMediaMessage` now returns `{id: messageId}`.
  Deliberately excluded (user-acknowledged): Linked devices (conflicts with one-device E2EE),
  Payments, Parental controls.
- **Adversarial code review of the batch** found 7 confirmed issues, all fixed. The big three
  were tombstone-model gaps: a deleted account's *other-device session* kept working
  (`loadProfile` only checked `!data`, not `deleted_at`) and could even republish a device key;
  the `users_update_self` RLS policy let a tombstoned session un-scrub its own row; and
  `_tombstone_user`'s cleanup list missed the broadcast tables added in the same batch (plus
  `find_or_create_dm` had no `deleted_at` guard, so a stale list entry could message a deleted
  account). All three fixed via **migration `0025`** + `lib/auth.tsx`. Also: list-edit save-path
  error handling (silent member wipeout on network blip), chat labels matched by `display_name`
  instead of user id (breaks when two members share a name), MediaTile permanent-spinner when
  auto-download is off (now a "Tap to download" placeholder), and broadcast log batched from ~60
  queries to 3 `.in()` queries.
- Support email in `help.tsx` → `support@craftloop.ca`. Build bumped 5 → 6 (all three places).
  Tests grew 102 → 107 (broadcast fan-out suite + tombstone sign-out regression test).
- **"Hearth 2.0" UI revamp planned and approved**, then **Phases A–D + part of E implemented**
  same session (build 6 → 7). User asked to see a working prototype before any real code changed
  — built as an Artifact (interactive phone mockup, both themes, chat list + thread screens)
  using the actual dark palette from `lib/theme.ts` plus the plan's proposed light palette;
  approved, then implementation started. Five commits, one per phase, `553571b`..`0b9cc0e`:
  - **Phase A**: `lib/theme.ts` split into `darkPalette`/`lightPalette` (same shape); new
    `useTheme()` in `lib/themeMode.tsx` composes the active ground with the user's accent ramp;
    `ThemeModeProvider` replaced the old `deepGround` boolean with `mode: 'system'|'light'|'dark'`
    (persisted, migrates the old storage key); `appearance.tsx` got a 3-way selector.
  - **Phase B**: new `components/ScreenHeader.tsx` (back-chevron + title/subtitle + right slot,
    with a `centerContent` override for the chat thread's avatar row) replaced the hand-rolled
    header in 20 screens; new `components/SettingsRow.tsx` adopted in edit-profile's menu; 11 new
    icons (chevron, search, send, check/double-check, close, bell/bell-off, archive) purged every
    stray Unicode glyph outside the chat thread/list (those were Phase C/D's own work).
  - **Phase C**: `MessageBubble.tsx` — filled own-bubble (no border), read receipts as
    accent-tinted check/double-check ticks *inside* the bubble, 2-minute-window message grouping
    (tight spacing + squared tail corner within a group, normal spacing + tail radius on the
    group's last bubble), "Today/Yesterday" date chips. `chat/[id].tsx`'s header now uses
    `ScreenHeader`'s `centerContent`. `Composer.tsx`'s send button is a Reanimated-driven filled
    circle that spring-scales in once there's text. `TypingIndicator.tsx` moved off RN's
    `Animated` onto Reanimated.
  - **Phase D**: `ChatRow.tsx`'s unread badge is a true pill (was `radius.sm`), bold title when
    unread, hairline dividers replaced by spacing; `SwipeableRow.tsx`'s four swipe actions get an
    icon above the label; chat list gained a leading `SearchIcon` and an accent-filled FAB
    (replacing the old header "+" glyph); tab bar icons get filled variants when active.
  - **Phase E (partial)**: `OutlineButton` gained a `filled` prop + Reanimated press-scale;
    `GroupAvatarStack` avatars get a ground-color ring. **Caught and fixed two real native-chrome
    bugs** that would have made light mode look broken device-wide regardless of any JS
    correctness: `app.json`'s `userInterfaceStyle` was hardcoded `"dark"` (→ `"automatic"`), and
    `_layout.tsx`'s `<StatusBar>` was hardcoded `style="light"` (→ follows `resolvedGround`). Also
    discovered `ios/` is gitignored/untracked (see Current state) while fixing the matching
    `Info.plist` key by hand. **NOT done**: the full `useTheme()` migration of the remaining ~48
    screens and deleting the legacy `colors` alias — see Immediate next step.
  - Caught one real bug mid-implementation: an early draft of `MessageBubble`'s own-bubble text
    color used `colors.accent100` (the frozen default-terracotta alias) directly in
    `StyleSheet.create` — exactly the documented gotcha below, and exactly the thing the user had
    just asked to confirm still worked. Fixed to read `accentColors.accent100` inline before it
    ever got tested, so the accent-color picker still recolors every bubble/icon/badge in the
    redesign as intended.
  - Build bumped 6 → 7 (all three places — see the `ios/` gitignore note above for why the two
    native-side edits are local-only). **Not yet archived to TestFlight** — see Immediate next
    step #1. `npx tsc --noEmit` clean and 107/107 tests passing after every phase.

## Previous session's work (2026-08-03/04) — large session, quick summary

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

## Gotchas hit across sessions, if they recur

- **`react-native-libsodium` AEAD calls require `additional_data` to be a string.** The TS
  types accept `string | Uint8Array | null`, but the native binding throws
  `"input type not yet implemented"` at runtime for anything but a string — pass `''` for
  "no AD", never `null`. The Jest mock (`lib/testUtils/libsodiumMock.js`) does NOT replicate
  this, so only device testing catches regressions. This broke all media sends once already.
- **`try/finally` without `catch` around send paths = invisible failures.** The media-send
  handlers swallowed every error for a full session's worth of debugging. Any new async send
  path in `chat/[id].tsx` must surface errors (the codebase pattern is `Alert.alert` with the
  real error message — that message is what identified the libsodium bug in one screenshot).
- **`.expo/types/router.d.ts` is a stale cache** — it only regenerates during a Metro bundle,
  which this project never runs locally. New expo-router routes fail `tsc` with bogus
  "not assignable to route" errors until the next real bundle. Workaround in the tree: `as any`
  casts on `router.push` targets in `edit-profile.tsx` (MENU_ROWS) and `lists.tsx`, each with a
  comment. They can be removed after any archive (the bundle regenerates the file).
- **Tombstone deletion has a wide blast radius.** Account removal is now `UPDATE users SET
  deleted_at=...` (never a row delete), which means FK `ON DELETE CASCADE` never fires — any
  NEW table with a `users(id)` FK must also be added to `_tombstone_user`'s explicit cleanup
  list (see `0025` for the shape), and any new "pick a member" query needs
  `.is('deleted_at', null)` (or go through `useMembers`, which has it). The code review caught
  three separate holes of exactly this shape — assume a fourth exists whenever users are
  referenced somewhere new.
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
  element anywhere in the app is the most likely regression path going forward. **Same trap
  applies to the Hearth 2.0 light/dark ground palette** (`useTheme()`), not just the accent
  ramp — caught a real instance mid-session where `MessageBubble`'s own-bubble text color was
  written as static `colors.accent100` (frozen dark-default) instead of inline
  `accentColors.accent100`; fixed before it shipped, but assume more exist in the ~48 screens
  not yet migrated off the legacy `colors` alias.
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
