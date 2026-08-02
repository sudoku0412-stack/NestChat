-- Document attachments: widen message_media.kind and add filename/size
-- (documents don't have width/height/duration, but do need a name to show).
alter table public.message_media drop constraint if exists message_media_kind_check;
alter table public.message_media add constraint message_media_kind_check
  check (kind in ('photo', 'video', 'document'));
alter table public.message_media add column if not exists file_name text;
alter table public.message_media add column if not exists file_size bigint;

-- Live location sharing: one row per active/past share, updated in place by a
-- background location task while the share is live. A message points at it via
-- messages.location_share_id; the bubble subscribes to this row's changes.
create table public.live_locations (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  stopped_at timestamptz,
  updated_at timestamptz not null default now()
);

create index live_locations_chat_id_idx on public.live_locations (chat_id);

alter table public.messages add column location_share_id uuid references public.live_locations(id) on delete set null;

alter table public.live_locations enable row level security;

create policy "live_locations_select_member" on public.live_locations
  for select to authenticated using (
    exists (select 1 from public.chat_members cm where cm.chat_id = live_locations.chat_id and cm.user_id = auth.uid())
  );

create policy "live_locations_insert_self" on public.live_locations
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.chat_members cm where cm.chat_id = live_locations.chat_id and cm.user_id = auth.uid())
  );

-- Only the sharer can update it (background task writes new coords/stop it as them).
create policy "live_locations_update_self" on public.live_locations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.live_locations;
