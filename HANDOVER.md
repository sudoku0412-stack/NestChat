# NestChat — Handover

Last updated: 2026-07-31 (end of session)

## What this is

Private household messaging app. Expo (React Native + TypeScript) + Supabase (Auth, Postgres,
Storage, Realtime). Full feature/setup docs are in [README.md](README.md) — read that first for
anything about running the app, Supabase setup, or design decisions. This file is for picking up
mid-stream: current state, what's broken/pending, what to check first.

## Current state

- Repo: https://github.com/sudoku0412-stack/NestChat (private)
- Supabase project: `sudoku0412-stack's Org / NestChat` (project ref `hfmjigdtmjbgyqcnneqt`)
- Auth: **anonymous auth + typed-in phone number**, not real OTP (no SMS provider — costs money,
  explicitly skipped for now). See README's "Phone number capture, no SMS" section for the
  tradeoff (no account recovery on logout/reinstall).
- Device: running as a dev build on an iPhone via Xcode + free personal Apple ID team (not
  TestFlight/EAS). That means: **no push notifications possible** (free team can't hold that
  entitlement), and the build **expires every 7 days** — reconnect the phone and Product ▶ Run
  from Xcode to refresh it.
- New Chat ("＋") reads the device's Contacts and matches phone numbers against everyone on
  NestChat (last-10-digits match, see `lib/contacts.ts`) — sectioned into On NestChat / Also on
  NestChat / Invite to NestChat.
- Settings screen roster section is labeled "Contacts" (not "Household members").

## Immediate next step for whoever picks this up

Migration `0004_fix_chat_members_rls_recursion.sql` has been run against the live Supabase
project (confirmed 2026-08-02). It fixed "infinite recursion detected in policy for relation
chat_members" — three RLS policies on `chat_members` queried `chat_members` from inside their
own policy definition. Chat list load and starting new DMs should now work.

## Known rough edges (not bugs, just unfinished/tradeoffs)

- No SMS OTP (see above) — anyone can create an account with any typed-in, unverified phone
  number. Signup is intentionally open, not invite-gated.
- Expired statuses aren't cleaned up automatically (optional `pg_cron` snippet in
  `0003_status.sql` if you want it).
- Household member removal is admin-only, but nobody starts as admin — first login needs a
  manual `update public.users set role = 'admin' where phone = '...'` in the SQL Editor.
- Full list of build-vs-prototype deviations is in README's "Design notes & deviations" section.

## Gotchas hit this session, if they recur

- **CocoaPods locale error** ("Unicode Normalization not appropriate for ASCII-8BIT") when
  running `pod install` or `expo prebuild` — this machine's shell locale isn't UTF-8. Fix:
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install` from inside `ios/`.
- **Push entitlement blocks builds** on the free Apple ID team — if `npx expo prebuild` is run
  again, it regenerates `ios/NestChat/NestChat.entitlements` with `aps-environment` back in,
  which the free team can't sign. Strip that key back out (empty `<dict></dict>`) before
  building in Xcode.
- **New native module added → must rebuild native project**: after `npx expo install
  <any-native-package>`, run `npx expo prebuild -p ios` + `pod install` (with the LANG fix above)
  and reinstall from Xcode — the JS bundle alone isn't enough, calling a native module that isn't
  compiled into the current binary can hard-crash the app rather than throw a catchable JS error.
- **Realtime channel names must be unique per hook instance**, not static strings — Expo
  Router's screen freeze/pre-render behavior can briefly double-mount a screen, and two realtime
  subscriptions with the identical channel name crash with "cannot add `postgres_changes`
  callbacks ... after `subscribe()`". All hooks in `lib/hooks/` already generate a unique
  suffix per mount (`useRef` + module-level counter) — keep that pattern for any new realtime
  hook.
- **"The database schema is invalid or incompatible"** — a Supabase Storage-service-level error
  (not from this app's code), seen after repeatedly creating/deleting buckets via mixed
  SQL + Dashboard actions. Fix: Project Settings → General → Restart project.
