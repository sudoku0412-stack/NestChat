-- NestChat schema + RLS
-- Run once against a fresh Supabase project (SQL editor, or `supabase db push`).

-- ============================================================================
-- Tables
-- ============================================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Nullable: anonymous auth sessions (see lib/auth.tsx continueWithPhone) create the
  -- auth.users row before a phone number is known, then the app fills it in right after.
  phone text unique,
  display_name text not null,
  avatar_url text,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  is_online boolean not null default false,
  last_seen_at timestamptz,
  show_read_receipts boolean not null default true,
  push_token text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group')),
  name text,
  avatar_url text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  muted boolean not null default false,
  archived boolean not null default false,
  last_read_message_id uuid,
  primary key (chat_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  body text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.message_media (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  thumbnail_path text,
  width int,
  height int,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create table public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index messages_chat_id_created_at_idx on public.messages (chat_id, created_at desc);
create index chat_members_user_id_idx on public.chat_members (user_id);
create index message_media_message_id_idx on public.message_media (message_id);

-- ============================================================================
-- New-user provisioning
-- Self-serve, no SMS/OTP cost: the app signs everyone in via
-- `supabase.auth.signInAnonymously()` (see lib/auth.tsx `continueWithPhone`),
-- then immediately updates public.users.phone with whatever number they
-- typed in (unverified — there's no code sent). Anonymous auth.users rows
-- have phone = '' (empty string, not null), so this trigger normalizes that
-- to a real NULL to avoid every anonymous signup colliding on the unique
-- constraint. The app then routes first-time users through
-- app/onboarding.tsx to set their name, optional avatar, and optional email.
--
-- Swapping in real phone OTP later: re-enable a Phone provider + SMS vendor
-- in the Supabase Dashboard, and switch lib/auth.tsx back to
-- `signInWithOtp`/`verifyOtp` (git history has the previous implementation).
-- ============================================================================

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, phone, display_name, role)
  values (
    new.id,
    nullif(new.phone, ''),
    'New Member',
    'member'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- Helper: find-or-create a 1:1 chat between the caller and another member
-- ============================================================================

create function public.find_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  select cm1.chat_id into existing_id
  from public.chat_members cm1
  join public.chat_members cm2 on cm2.chat_id = cm1.chat_id
  join public.chats c on c.id = cm1.chat_id
  where c.type = 'dm'
    and cm1.user_id = auth.uid()
    and cm2.user_id = other_user_id
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.chats (type, created_by) values ('dm', auth.uid()) returning id into new_id;
  insert into public.chat_members (chat_id, user_id) values (new_id, auth.uid()), (new_id, other_user_id);

  return new_id;
end;
$$;

-- ============================================================================
-- Bootstrapping an admin
-- Self-serve signup means everyone starts as role = 'member' — nobody can
-- call remove_household_member until at least one admin exists. After your
-- own first login, promote yourself once via the SQL Editor:
--   update public.users set role = 'admin' where phone = '+15551234567';
-- ============================================================================

-- ============================================================================
-- Helper: remove a household member (admin only). Deletes their profile row
-- (cascades to chat_members/messages stay, sender_id preserved via FK) but
-- does NOT delete the underlying auth.users row — do that in the Supabase
-- Dashboard to fully revoke login.
-- ============================================================================

create function public.remove_household_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
    raise exception 'Only admins can remove household members';
  end if;
  delete from public.users where id = target_user_id;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.users enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_media enable row level security;
alter table public.message_reads enable row level security;

-- users: every household member can see the roster; you can only edit yourself.
create policy "users_select_all" on public.users
  for select to authenticated using (true);

create policy "users_update_self" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- chats: only visible to members of that chat.
create policy "chats_select_member" on public.chats
  for select to authenticated using (
    exists (select 1 from public.chat_members cm where cm.chat_id = chats.id and cm.user_id = auth.uid())
  );

create policy "chats_insert_any" on public.chats
  for insert to authenticated with check (created_by = auth.uid());

create policy "chats_update_member" on public.chats
  for update to authenticated using (
    exists (select 1 from public.chat_members cm where cm.chat_id = chats.id and cm.user_id = auth.uid())
  );

-- chat_members: visible to co-members; insertable by the chat creator (initial
-- roster) or by yourself; any co-member can update/remove (matches "any member
-- can invite/remove" household model — see design-doc.md §5.6).
--
-- The "am I a co-member of this chat" check can't be a plain subquery on
-- chat_members from inside a chat_members policy — Postgres re-applies the
-- policy to that inner query too, recursing forever ("infinite recursion
-- detected in policy for relation chat_members"). Routing it through a
-- security-definer function bypasses RLS for just that inner lookup.
create function public.is_chat_member(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id and user_id = p_user_id
  );
$$;

create policy "chat_members_select_comember" on public.chat_members
  for select to authenticated using (
    public.is_chat_member(chat_members.chat_id, auth.uid())
  );

create policy "chat_members_insert_creator_or_self" on public.chat_members
  for insert to authenticated with check (
    user_id = auth.uid()
    or exists (select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid())
  );

create policy "chat_members_update_comember" on public.chat_members
  for update to authenticated using (
    public.is_chat_member(chat_members.chat_id, auth.uid())
  );

create policy "chat_members_delete_comember" on public.chat_members
  for delete to authenticated using (
    public.is_chat_member(chat_members.chat_id, auth.uid())
  );

-- messages: visible to chat members; only the sender can insert as themselves;
-- only the sender can update (soft delete via deleted_at).
create policy "messages_select_member" on public.messages
  for select to authenticated using (
    exists (select 1 from public.chat_members cm where cm.chat_id = messages.chat_id and cm.user_id = auth.uid())
  );

create policy "messages_insert_member" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.chat_members cm where cm.chat_id = messages.chat_id and cm.user_id = auth.uid())
  );

create policy "messages_update_sender" on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- message_media: follows the parent message's chat membership.
create policy "message_media_select_member" on public.message_media
  for select to authenticated using (
    exists (
      select 1 from public.messages m
      join public.chat_members cm on cm.chat_id = m.chat_id
      where m.id = message_media.message_id and cm.user_id = auth.uid()
    )
  );

create policy "message_media_insert_sender" on public.message_media
  for insert to authenticated with check (
    exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid())
  );

-- message_reads: visible to chat members; you can only mark yourself as having read.
create policy "message_reads_select_member" on public.message_reads
  for select to authenticated using (
    exists (
      select 1 from public.messages m
      join public.chat_members cm on cm.chat_id = m.chat_id
      where m.id = message_reads.message_id and cm.user_id = auth.uid()
    )
  );

create policy "message_reads_insert_self" on public.message_reads
  for insert to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Realtime
-- ============================================================================

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chat_members;
alter publication supabase_realtime add table public.message_reads;
alter publication supabase_realtime add table public.users;

-- ============================================================================
-- Storage: private bucket for photo/video attachments.
-- Object path convention: {chat_id}/{message_id}/{filename}
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

create policy "chat_media_select_member" on storage.objects
  for select to authenticated using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = (split_part(name, '/', 1))::uuid
        and cm.user_id = auth.uid()
    )
  );

create policy "chat_media_insert_member" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = (split_part(name, '/', 1))::uuid
        and cm.user_id = auth.uid()
    )
  );

create policy "chat_media_delete_member" on storage.objects
  for delete to authenticated using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = (split_part(name, '/', 1))::uuid
        and cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Storage: public bucket for profile avatars (set during onboarding or from
-- Settings later). Public read since avatars are shown throughout the app
-- without a signed-URL round trip; only the owner can write their own folder.
-- Object path convention: {user_id}/avatar.jpg
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_select_public" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (split_part(name, '/', 1))::uuid = auth.uid()
  );

create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (split_part(name, '/', 1))::uuid = auth.uid()
  );

create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (split_part(name, '/', 1))::uuid = auth.uid()
  );
