# NestChat

Private, invite-only messaging for one household. iOS-first, built with Expo (React Native +
TypeScript) and Supabase (Auth, Postgres, Storage, Realtime).

Sign-in is self-serve — no admin has to provision accounts. Anyone with the app enters a phone
number and lands straight in a one-time onboarding screen to set their name, an optional photo,
and an optional email. **No OTP code is sent** (see [Phone number capture, no SMS](#phone-number-capture-no-sms)
below for why and what that trades away), and **signup is open** — anyone who gets the app can
join, not just people you've approved. Both are explicit tradeoffs; see
[Design notes & deviations](#design-notes--deviations) if you want to lock either down later.

Visual design follows the provided handoff (`Household Chat` prototype + design-doc), built on
the bound **Nocturne** design system tokens (dark ground `#161826`, blurple accent `#9184d9`,
Inter type, soft radii) — see [Design notes & deviations](#design-notes--deviations) below for
the couple of places this build diverges from the click-through prototype.

## Project structure

```
app/                      Expo Router routes
  _layout.tsx             Root layout: gesture handler, safe area, theme, auth provider
  index.tsx                Redirects to /login, /onboarding, or /(app)
  login.tsx                 Phone number entry (no OTP — see README)
  onboarding.tsx             First-login setup: name, optional photo, optional email
  (app)/                    Authenticated stack
    _layout.tsx              Auth/onboarding guard + presence/push registration
    index.tsx                 Chat list (+ status strip)
    chat/[id].tsx              Thread (1:1 or group)
    group-info/[id].tsx         Group member list (view/add/remove)
    media-viewer.tsx            Full-screen photo/video viewer
    members.tsx                  Household roster → start a DM or select group members
    new-group.tsx                 Create a group
    status/new.tsx                 Post a text/photo/video status
    status/[userId].tsx             Story-style status viewer
    settings/index.tsx             Profile, appearance, privacy, roster, log out
components/                Reusable UI (Avatar, ChatRow, MessageBubble, Composer, StatusRing, ...)
lib/                       Supabase client, auth/theme contexts, hooks, business logic
supabase/
  migrations/               SQL schema + RLS policies (run in order)
  functions/send-push/       Edge Function that sends push notifications on new messages
```

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the migrations **in order**:
   - `supabase/migrations/0001_init.sql` — tables (including phone-based `users`), RLS policies,
     `avatars`/`chat-media` storage buckets + policies, the `handle_new_auth_user` trigger, and
     the `find_or_create_dm` / `remove_household_member` helper functions.
   - `supabase/migrations/0002_chat_list_rpc.sql` — the `get_chat_list` / `mark_chat_read` RPCs
     the Chat List and Thread screens call.
   - `supabase/migrations/0003_status.sql` — `statuses` / `status_views` tables, RLS, and the
     `status-media` storage bucket for the Status feature.
3. Under **Project Settings → API**, copy the **Project URL** and **anon public** key.

### Phone number capture, no SMS

Real SMS delivery (Twilio, MessageBird, Vonage, etc.) always costs money per message — there's
no way around that, carriers require a paid gateway to accept SMS from a server. To skip that
cost, this app signs everyone in with **Supabase's anonymous auth** instead of phone OTP: no
code is sent, the phone number you type is just stored against your profile, unverified.

1. In Supabase Dashboard: **Authentication → Sign In / Providers → Anonymous Sign-Ins** → enable
   it. (It's off by default on new projects.) No other config, no SMS vendor, no cost.
2. That's the entire setup — `supabase.auth.signInAnonymously()` (wired up in `lib/auth.tsx`'s
   `continueWithPhone`) handles the rest.

**The real tradeoff**: an anonymous session isn't backed by a credential you can log back in
with. If someone logs out or reinstalls the app, they cannot recover their old account — signing
in again just creates a brand-new one, with a new empty chat history. Fine for testing; revisit
before you rely on this day-to-day. When you're ready for real verified phone login, pick an SMS
provider, enable **Authentication → Providers → Phone** instead, and swap
`continueWithPhone`'s `signInAnonymously()` call back to `signInWithOtp` / `verifyOtp` (the
previous implementation is in this repo's git history if you want a reference).

### First login & becoming admin

Open the app, enter your phone number, and fill out the onboarding screen — that's the entire
signup flow, no dashboard steps needed. `handle_new_auth_user` mirrors every new signup into
`public.users` automatically, `role` defaulting to `'member'`.

Nobody starts as `'admin'` (admin-only actions: removing a household member from Settings). One
time, after your first login, promote yourself via the SQL Editor:

```sql
update public.users set role = 'admin' where phone = '+15551234567';
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GIPHY_API_KEY=your-giphy-api-key
```

These are read at build time via Expo's built-in `EXPO_PUBLIC_*` env support — no extra config
needed. `.env` is gitignored; don't commit real keys.

The Giphy key powers the composer's GIF/sticker picker (`lib/giphy.ts`) — get a free one at
https://developers.giphy.com/dashboard/ (Create an App → API, not SDK). Without it, the picker
just stays empty (see the console warning in `lib/giphy.ts`) rather than crashing.

## 3. Run the app

```bash
npm install
npx expo start
```

- **iOS Simulator**: press `i` in the terminal (requires Xcode installed).
- **Physical iPhone via Expo Go**: install [Expo Go](https://expo.dev/go) from the App Store,
  then scan the QR code from `expo start`. Camera/photo-library attachments and push
  notifications work in Expo Go, but push tokens require a physical device (not the simulator).
- **Physical iPhone via a dev build** (recommended before distributing to the household,
  since Expo Go doesn't support custom native config forever and gives you a real app icon):
  ```bash
  npx expo prebuild -p ios
  npx expo run:ios --device
  ```
  or build with [EAS Build](https://docs.expo.dev/build/introduction/) and install via
  TestFlight / ad-hoc distribution.

## 4. Push notifications

Client-side registration (requesting permission, fetching an Expo push token, saving it to
`users.push_token`) is already wired up in `lib/notifications.ts` and runs automatically once a
user is logged in on a physical device.

To actually *send* notifications when a new message arrives, deploy the included Edge Function
and connect it to a Database Webhook:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy send-push
```

Then in the Supabase Dashboard: **Database → Webhooks → Create a new webhook**
- Table: `messages`, Event: `INSERT`
- Type: **Supabase Edge Function** → select `send-push`

The function looks up non-muted chat members (excluding the sender), reads their
`push_token`, and sends via Expo's push API. Muted chats are skipped server-side.

## Design notes & deviations

The prototype and design-doc disagree on which design system is bound (design-doc.md's prose
describes a red/zero-radius "Modernist" system, but the README and `_ds/nocturne/styles.css`
explicitly declare **Nocturne** as source of truth) — this build follows Nocturne, per the
handoff README's explicit instruction.

A few places intentionally depart from the click-through prototype, mostly where the task's
functional requirements or basic security took precedence over pixel-fidelity:

- **Signup is fully open**, not invite-only. Anyone with the app can create an account — there's
  no allowlist gate (a deliberate choice, made explicitly when this was built, favoring
  WhatsApp-style frictionless signup over the app's original "household members only" framing).
  If you want it locked down: add a `public.allowed_phones` table an admin populates, and check
  it inside `handle_new_auth_user()` — raise an exception there if the phone isn't on the list.
- **Phone numbers are unverified.** Since there's no OTP (see
  [Phone number capture, no SMS](#phone-number-capture-no-sms)), anyone can type in any number,
  including someone else's. It's just a display/identification field, not proof of ownership.
- **Attach menu** offers Camera / Photo & Video Library instead of the prototype's four options
  (Photo/File/Location/Contact) — only photo/video attachments were in scope.
- **New chat entry point**: the prototype only shows a "New Group" header icon. This build adds
  a "＋" icon that opens a Members screen for either starting a 1:1 chat (tap a member) or
  building a group (check members, then "New Group").
- **Household member removal** (Settings) is restricted to `role = 'admin'` accounts, rather
  than the prototype's "any member can remove any member." Removing a member deletes their
  `public.users` row (and their chat memberships) but does **not** delete the underlying
  `auth.users` record — do that separately in the Dashboard to fully revoke login.
- **"Add member"** in Settings shows an explanatory alert (there's no invite code — just have
  them install the app and sign in with their own number) instead of an in-app form.
- **Status** (added after the initial build, not from the original design handoff): text
  statuses cycle through a small fixed color palette rather than a free color picker; there's no
  hold-to-pause on the viewer (tap left/right third of the screen to go back/forward, or wait for
  auto-advance); a status posted with no viewers shown yet still renders the "Viewed by" bar for
  the owner, just with an empty list.
- **Dark mode** toggle switches between two ground depths (`#161826` / `#0f1120`) applied to
  each screen's top-level background, per the handoff README's note that this system's ground
  is dark-only and the switch is "a stand-in for whatever theme axis the real system should
  expose." Surfaces, bubbles, and text colors don't change with it.
- **Archived chats** are hidden from the Chat List (their `chat_members.archived` flag is set)
  but there's no dedicated "Archived" screen yet to view/restore them — noted as a known gap,
  matching the design-doc's own call-out that this wasn't modeled in the prototype either.
- **Read receipts** are a single client-side toggle (`users.show_read_receipts`) that controls
  whether the viewer's own client renders "Delivered"/"Read" text — it isn't enforced
  server-side against the sender's preference.
- **Video thumbnails** aren't generated; video bubbles show a play glyph over the first frame
  once loaded rather than a distinct poster image.
- **Media compression**: photos are automatically resized/re-encoded (max width 1600px, JPEG
  quality 0.7) before upload; there's no "send full quality" override or per-send prompt.
  Videos upload as-is (no client-side transcoding).

## Known limitations / follow-ups

- No automated tests.
- Realtime updates refetch their screen's data wholesale on any relevant change rather than
  patching individual rows — fine at household scale (~15 members), but not how you'd build it
  for a larger app.
- `chat_members_delete_comember` / `chat_members_update_comember` RLS policies let any chat
  co-member mute, remove, or leave-on-behalf-of any other member of that chat (matches the
  design-doc's stated "any member can invite/remove" household model — tighten this if that's
  not the trust model you want).
- **Expired statuses aren't deleted**, just filtered out by RLS/queries (`expires_at > now()`).
  They'll accumulate in the `statuses` table forever unless you enable the optional `pg_cron`
  cleanup job commented at the bottom of `0003_status.sql`.
- **No account recovery.** Anonymous auth sessions (see
  [Phone number capture, no SMS](#phone-number-capture-no-sms)) can't be re-authenticated after a
  logout or reinstall — there's no password, email link, or verified phone to prove it's the
  same person. Losing the session means losing that identity permanently.
