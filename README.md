# NestChat

Private, invite-only messaging for one household. iOS-first, built with Expo (React Native +
TypeScript) and Supabase (Auth, Postgres, Storage, Realtime).

There is no public sign-up screen — a household admin creates accounts directly in the
Supabase Dashboard, and members log in with email/password.

Visual design follows the provided handoff (`Household Chat` prototype + design-doc), built on
the bound **Nocturne** design system tokens (dark ground `#161826`, blurple accent `#9184d9`,
Inter type, soft radii) — see [Design notes & deviations](#design-notes--deviations) below for
the couple of places this build diverges from the click-through prototype.

## Project structure

```
app/                      Expo Router routes
  _layout.tsx             Root layout: gesture handler, safe area, theme, auth provider
  index.tsx                Redirects to /login or /(app) based on session
  login.tsx                 Email/password login
  (app)/                    Authenticated stack
    _layout.tsx              Auth guard + presence/push registration
    index.tsx                 Chat list
    chat/[id].tsx              Thread (1:1 or group)
    group-info/[id].tsx         Group member list (view/add/remove)
    media-viewer.tsx            Full-screen photo/video viewer
    members.tsx                  Household roster → start a DM or select group members
    new-group.tsx                 Create a group
    settings/index.tsx             Profile, appearance, privacy, roster, log out
components/                Reusable UI (Avatar, ChatRow, MessageBubble, Composer, ...)
lib/                       Supabase client, auth/theme contexts, hooks, business logic
supabase/
  migrations/               SQL schema + RLS policies (run in order)
  functions/send-push/       Edge Function that sends push notifications on new messages
```

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the migrations in order:
   - `supabase/migrations/0001_init.sql` — tables, RLS policies, storage bucket + policies,
     the `handle_new_auth_user` trigger, and the `find_or_create_dm` / `remove_household_member`
     helper functions.
   - `supabase/migrations/0002_chat_list_rpc.sql` — the `get_chat_list` / `mark_chat_read` RPCs
     the Chat List and Thread screens call.
3. Under **Project Settings → API**, copy the **Project URL** and **anon public** key.

### Add household members

There's no in-app sign-up. For each household member:

1. Go to **Authentication → Users → Add user** in the Supabase Dashboard.
2. Set their email and a password (share it with them out of band; they can't reset it
   themselves without email sending configured).
3. Optionally set **User Metadata** to `{ "display_name": "Jamie", "role": "admin" }` — if
   omitted, `display_name` defaults to the email's local part and `role` defaults to `"member"`.

A database trigger (`on_auth_user_created`) automatically mirrors the new auth user into
`public.users`, so they show up in the app's member list right away. Only `role = 'admin'`
accounts can remove other members from the Settings screen.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These are read at build time via Expo's built-in `EXPO_PUBLIC_*` env support — no extra config
needed. `.env` is gitignored; don't commit real keys.

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

- **Login** uses email + password instead of a single invite-code field, per the requirement
  that admins provision accounts directly in Supabase (no invite-code flow exists server-side).
- **Attach menu** offers Camera / Photo & Video Library instead of the prototype's four options
  (Photo/File/Location/Contact) — only photo/video attachments were in scope.
- **New chat entry point**: the prototype only shows a "New Group" header icon. This build adds
  a "＋" icon that opens a Members screen for either starting a 1:1 chat (tap a member) or
  building a group (check members, then "New Group").
- **Household member removal** (Settings) is restricted to `role = 'admin'` accounts, rather
  than the prototype's "any member can remove any member." Removing a member deletes their
  `public.users` row (and their chat memberships) but does **not** delete the underlying
  `auth.users` record — do that separately in the Dashboard to fully revoke login.
- **"Add member"** in Settings shows an explanatory alert instead of an in-app form, since
  account creation is Supabase-Dashboard-only by design.
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
