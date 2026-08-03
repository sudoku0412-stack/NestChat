# NestChat — Handover

Last updated: 2026-08-02 (end of session)

## What this is

Private household messaging app. Expo (React Native + TypeScript) + Supabase (Auth, Postgres,
Storage, Realtime). Full feature/setup docs are in [README.md](README.md) — read that first for
anything about running the app, Supabase setup, or design decisions. This file is for picking up
mid-stream: current state, what's broken/pending, what to check first.

## Current state

- Repo: https://github.com/sudoku0412-stack/NestChat (private)
- Supabase project: `sudoku0412-stack's Org / NestChat` (project ref `hfmjigdtmjbgyqcnneqt`)
- Auth: **anonymous auth + typed-in phone number**, not real OTP. See README's "Phone number
  capture, no SMS" section for the tradeoff (no account recovery on logout/reinstall).
- **Apple Developer account is now paid** (upgraded this session from the free personal team).
  Push notifications work now; the 7-day free-team build expiry no longer applies once you're
  running from TestFlight instead of a raw Xcode dev build.
- Navigation is now three tabs: **Chats** (middle, default) / **Status** (left) / **Settings**
  (right) — see `app/(app)/(tabs)/`. Opening a chat/thread/etc. still pushes on top and hides the
  tab bar, same as WhatsApp.
- New Chat ("＋") reads the device's Contacts and matches phone numbers against everyone on
  NestChat (last-10-digits match, see `lib/contacts.ts`) — sectioned into On NestChat / Also on
  NestChat / Invite to NestChat.
- Chat attachment menu (the "+" in the composer) is a rounded icon grid: Camera, Gallery,
  Document, Contact, Share Live Location.
- **Live location sharing**: pick 15 min / 24 hr / until-stopped, updates in the background via
  `expo-location` + `expo-task-manager` (`lib/liveLocation.ts`, `lib/locationTask.ts`). Renders as
  coordinates + "Open in Maps" (no embedded map — no maps SDK in the app).
- **Jest test suite** covering business logic (chat/status actions, media upload logic, contact
  matching, live-location math, the useMessages/useChatList hooks). Run with `npm test`. A husky
  **pre-push hook** (`.husky/pre-push`) runs `tsc --noEmit` + `npm test` automatically before every
  `git push` — if either fails, the push is blocked. Does **not** cover native/device-only
  behavior (camera, background location, real push delivery, realtime socket internals) — that
  still needs manual on-device QA.

## Immediate next step for whoever picks this up

**Mid-way through submitting the app to TestFlight** (household-only distribution, not a public
App Store listing — see "Why TestFlight, not public App Store" below). Current status:

1. ✅ App Store Connect app record exists (Apple ID `6797336582`), App Information filled in,
   Age Rating done (calculated **4+**), App Privacy data-collection label fully filled out and
   **published**.
2. ✅ Privacy policy is live at **https://sudoku0412-stack.github.io/nestchat-privacy/** — hosted
   from a **separate small public repo** (`sudoku0412-stack/nestchat-privacy`, just one
   `index.html`), because GitHub Pages doesn't work on this repo (private + GitHub Free plan). The
   source content also lives at `docs/privacy.html` in *this* repo for editing — if you change the
   policy text, update both `docs/privacy.html` here **and** push the same content to the
   `nestchat-privacy` repo's `index.html` (they are not auto-synced).
3. ✅ Migration `0005_documents_and_live_location.sql` has been run against the live Supabase
   project (confirmed via Schema Visualizer — `live_locations` table and `location_share_id`
   column exist).
4. ✅ Apple Push Notifications Key created via `eas credentials` and assigned to the project.
   `send-push` Edge Function is deployed with `--no-verify-jwt`, and a `pg_net`-based trigger
   (`notify_send_push()` function + `send_push_on_message` trigger, created directly via SQL
   since this project's `supabase_functions` schema doesn't exist) fires it on every new message.
5. ⏳ **An archive was built and exported, but never actually uploaded to App Store Connect.**
   Xcode packaged a valid `.ipa` (no blocking errors — the only log noise was benign
   "Upload Symbols Failed" dSYM warnings) but dropped it to
   `~/Downloads/NestChat 2026-08-02 20-08-40/NestChat.ipa` instead of uploading. **Next action:**
   either open **Transporter** (free Mac App Store app) and drag that `.ipa` in to upload it
   directly, or go back to Xcode Organizer → Distribute App → TestFlight & App Store and let it
   run all the way through the upload step this time.
6. Once a build shows up and finishes processing in App Store Connect → TestFlight tab: create an
   **External Testing** group, add household members' Apple ID emails, write a "what to test"
   note, and submit — this triggers a lightweight Beta App Review (usually ~1 day), much lighter
   than full App Store review.

### Why TestFlight, not public App Store

This app's data model has **no invite gating or per-user visibility scoping** — `users_select_all`
RLS lets any authenticated user see every other user's name and phone number, and anyone can sign
up with any unverified phone number (see "No SMS OTP" below). That's fine for TestFlight (only
people you explicitly invite by email can even install it), but would be a real privacy problem on
a public App Store listing where anyone in the world could sign up and see the whole roster. If
this ever needs to go fully public, that gap needs fixing first (invite codes, or scoping
"Contacts" to only people you actually share a chat with).

## Known rough edges (not bugs, just unfinished/tradeoffs)

- No SMS OTP — anyone can create an account with any typed-in, unverified phone number. Signup is
  intentionally open, not invite-gated. See "Why TestFlight, not public App Store" above for why
  this matters for distribution.
- Live location sharing asks for "Always" location permission (needed for background updates) —
  a fairly invasive ask; worth deciding if that tradeoff is acceptable before wider rollout.
- Expired statuses aren't cleaned up automatically (optional `pg_cron` snippet in
  `0003_status.sql` if you want it).
- Household member removal is admin-only — the current admin is set correctly now
  (`b43fffb5...`, "Kaushik Majumder"). If a *new* household spins this up from scratch, first
  login still needs a manual `update public.users set role = 'admin' where id = '...'` in the SQL
  Editor (match by `id`, not `phone` — see the gotcha below on why).
- No in-app account deletion flow. Not required for TestFlight-only distribution, but Apple
  requires it (Guideline 5.1.1v) before any future public App Store submission.
- Full list of build-vs-prototype deviations is in README's "Design notes & deviations" section.

## Gotchas hit this session, if they recur

- **Realtime channel silently stops delivering, forever, with no error** — turned out to be a
  stale/expiring auth token on the socket. Fixed in `useMessages.ts` / `useChatList.ts` by calling
  `supabase.realtime.setAuth(token)` before every (re)subscribe, plus exponential backoff on
  reconnect (the first fix attempt had no backoff and looped instantly, which is worse — watch for
  a tight `CLOSED` → resubscribe → `CLOSED` loop in the console if this regresses). There's also a
  belt-and-suspenders poll (`setInterval`) so the UI stays correct even if realtime never recovers.
- **`mark_chat_read` must not fire on every realtime-triggered refetch** — it used to run
  unconditionally inside the `postgres_changes` subscription callback, which (after the auth-token
  fix above) could re-trigger itself via the very `chat_members` update it makes, if not gated.
  Fixed by only calling it when the newest message id actually changed (tracked via a ref). This
  has a regression test in `lib/hooks/useMessages.test.ts`.
- **Never run ad-hoc test/diagnostic scripts against the live Supabase project** — earlier this
  session I (Claude) ran Node scripts directly against the production database to debug realtime,
  which created ~10 junk "New Member" accounts visible in Settings → Contacts. Cleaned up via
  `delete from public.users where phone is null`, but that filter accidentally deleted the *real*
  admin account too (it had a null phone for unrelated reasons), which required manually
  re-inserting a profile row and re-promoting to admin — the account only survived because
  Supabase auth sessions (`auth.users`) are separate from the `public.users` profile row, so the
  login session itself was never lost. **Any future debugging like this belongs in a disposable
  Supabase project, not this one.**
- **Promote-to-admin by `phone`, not `id`, is fragile** — a phone-format mismatch (e.g. with vs.
  without `+1`) can silently promote the wrong account. Always match by `id` when changing roles.
- **CocoaPods locale error** ("Unicode Normalization not appropriate for ASCII-8BIT") when
  running `pod install` or `expo prebuild` — this machine's shell locale isn't UTF-8. Fix:
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install` from inside `ios/`.
- **Push Notifications capability must be added via Xcode's "+ Capability" button**, not just by
  hand-editing the entitlements plist — doing only the latter produces a confusing Xcode error
  ("The capability associated with PUSH_NOTIFICATIONS could not be determined"). Now that the
  Apple Developer account is paid, `aps-environment` should stay in
  `ios/NestChat/NestChat.entitlements` (don't strip it like the old free-team workaround did).
- **`expo-location` + `expo-task-manager` cause `expo prebuild` to add extra `UIBackgroundModes`**
  (`fetch`, `processing`, `external-accessory`, `audio`) that this app doesn't use. The
  `processing` one specifically fails App Store validation with "Missing Info.plist value...
  BGTaskSchedulerPermittedIdentifiers" since we don't use BGTaskScheduler. Fix: trim
  `ios/NestChat/Info.plist`'s `UIBackgroundModes` down to just `location` + `remote-notification`.
  Since `ios/` is gitignored, **this needs redoing every time `expo prebuild` runs again.**
- **New native module added → must rebuild native project**: after `npx expo install
  <any-native-package>`, run `npx expo prebuild -p ios` + `pod install` (with the LANG fix above)
  and reinstall from Xcode — the JS bundle alone isn't enough, calling a native module that isn't
  compiled into the current binary can hard-crash the app rather than throw a catchable JS error.
- **Realtime channel names must be unique per hook instance**, not static strings — Expo
  Router's screen freeze/pre-render behavior can briefly double-mount a screen, and two realtime
  subscriptions with the identical channel name crash. All hooks in `lib/hooks/` generate a
  unique suffix per mount/subscribe attempt — keep that pattern for any new realtime hook.
- **"The database schema is invalid or incompatible"** — a Supabase Storage-service-level error
  (not from this app's code), seen after repeatedly creating/deleting buckets via mixed
  SQL + Dashboard actions. Fix: Project Settings → General → Restart project.
- **`@testing-library/react-native` v14's `renderHook` is `async`** — must `await renderHook(...)`
  or you silently get a Promise instead of `{result, unmount}` and every assertion fails
  confusingly. It also needs the `test-renderer` npm package (the community fork), not the
  deprecated `react-test-renderer` — `npm install --save-dev test-renderer`.
- **`eas.json` is required just to run `eas credentials`**, even when not using EAS Build at all —
  a minimal file with one `build` profile is enough (see the repo's `eas.json`).
- **GitHub Pages doesn't work on private repos on the Free plan.** Hosted the privacy policy from
  a separate throwaway public repo instead — see "Immediate next step" above.
