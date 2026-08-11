-- E2EE key infrastructure (Phase 1 of the encryption rollout -- see HANDOVER.md). No message
-- content is encrypted yet; this migration only adds the tables/columns the crypto layer needs.
--
-- Key model: each user has one X25519 identity keypair (public half published here, private half
-- never leaves the device). Each chat has a symmetric key, wrapped (crypto_box_seal) to every
-- member's public key individually -- so the server only ever sees ciphertext of the chat key,
-- never the key itself. One shared household_keys/household_key_members pair (Phase 4) covers
-- statuses, which broadcast to everyone rather than to one chat's members.

alter table public.users add column if not exists public_key text;
alter table public.users add column if not exists key_updated_at timestamptz;

create table public.chat_keys (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table public.chat_key_members (
  key_id uuid not null references public.chat_keys(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  wrapped_key text not null,
  created_at timestamptz not null default now(),
  primary key (key_id, user_id)
);

create table public.household_keys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table public.household_key_members (
  key_id uuid not null references public.household_keys(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  wrapped_key text not null,
  created_at timestamptz not null default now(),
  primary key (key_id, user_id)
);

-- Message/media columns used starting Phase 2/3. Nullable + a version flag so existing plaintext
-- rows (enc_v is null) keep rendering as-is -- there is no backfill, the server can't retroactively
-- encrypt history it already saw in plaintext.
alter table public.messages add column if not exists enc_v smallint;
alter table public.messages add column if not exists key_id uuid references public.chat_keys(id);
alter table public.messages add column if not exists ciphertext text;
alter table public.message_media add column if not exists wrapped_key text;

alter table public.chat_keys enable row level security;
alter table public.chat_key_members enable row level security;
alter table public.household_keys enable row level security;
alter table public.household_key_members enable row level security;

-- chat_keys: visible to chat members (mirrors message_media's "via parent's chat membership"
-- pattern); only a chat member can create a new key row for their own chat.
create policy "chat_keys_select_member" on public.chat_keys
  for select to authenticated using (
    public.is_chat_member(chat_keys.chat_id, auth.uid())
  );

create policy "chat_keys_insert_member" on public.chat_keys
  for insert to authenticated with check (
    public.is_chat_member(chat_keys.chat_id, auth.uid())
  );

create policy "chat_keys_update_member" on public.chat_keys
  for update to authenticated using (
    public.is_chat_member(chat_keys.chat_id, auth.uid())
  );

-- chat_key_members: any chat member can see who has a wrap (so clients know who still needs
-- rewrapping after a membership change or reinstall) and can insert wraps for co-members
-- (that's how "someone else wraps the key for the new/reinstalled member" works) -- but a wrap's
-- content is meaningless to the server/other members without the recipient's private key, so
-- this is not the confidentiality boundary; chat membership already is.
create policy "chat_key_members_select_member" on public.chat_key_members
  for select to authenticated using (
    exists (
      select 1 from public.chat_keys ck
      where ck.id = chat_key_members.key_id and public.is_chat_member(ck.chat_id, auth.uid())
    )
  );

create policy "chat_key_members_insert_member" on public.chat_key_members
  for insert to authenticated with check (
    exists (
      select 1 from public.chat_keys ck
      where ck.id = chat_key_members.key_id and public.is_chat_member(ck.chat_id, auth.uid())
    )
  );

-- household_keys/household_key_members: same shape, but "member" means any user (household-wide),
-- matching statuses' existing all-users visibility model rather than per-chat membership.
create policy "household_keys_select_any" on public.household_keys
  for select to authenticated using (true);

create policy "household_keys_insert_any" on public.household_keys
  for insert to authenticated with check (true);

create policy "household_key_members_select_any" on public.household_key_members
  for select to authenticated using (true);

create policy "household_key_members_insert_any" on public.household_key_members
  for insert to authenticated with check (true);
