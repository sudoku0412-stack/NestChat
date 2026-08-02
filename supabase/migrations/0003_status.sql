-- WhatsApp-style Status: text/photo/video posts visible to every household
-- member for 24 hours. No "close friends" grouping — this is a private
-- household app, so visibility is simply "any signed-in member."

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('text', 'photo', 'video')),
  text_content text,
  background_color text,
  storage_path text,
  thumbnail_path text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);

create index statuses_user_id_idx on public.statuses (user_id);
create index statuses_expires_at_idx on public.statuses (expires_at);

alter table public.statuses enable row level security;
alter table public.status_views enable row level security;

-- Anyone can see their own statuses (even expired, so they can manage them);
-- everyone can see everyone else's while unexpired.
create policy "statuses_select_active_or_own" on public.statuses
  for select to authenticated using (
    expires_at > now() or user_id = auth.uid()
  );

create policy "statuses_insert_self" on public.statuses
  for insert to authenticated with check (user_id = auth.uid());

create policy "statuses_delete_self" on public.statuses
  for delete to authenticated using (user_id = auth.uid());

-- Viewers can see their own view receipts; a status's owner can see who
-- viewed it (the "viewed by" list).
create policy "status_views_select_owner_or_self" on public.status_views
  for select to authenticated using (
    viewer_id = auth.uid()
    or exists (select 1 from public.statuses s where s.id = status_id and s.user_id = auth.uid())
  );

create policy "status_views_insert_self" on public.status_views
  for insert to authenticated with check (viewer_id = auth.uid());

alter publication supabase_realtime add table public.statuses;
alter publication supabase_realtime add table public.status_views;

-- Storage: private bucket for status photo/video content.
-- Object path convention: {user_id}/{timestamp}.{ext}
insert into storage.buckets (id, name, public)
values ('status-media', 'status-media', false)
on conflict (id) do nothing;

-- Any household member can view any status media (matches the statuses
-- table's own visibility rule) — only the owner can upload/delete into their
-- own folder.
create policy "status_media_select_any_member" on storage.objects
  for select to authenticated using (bucket_id = 'status-media');

create policy "status_media_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'status-media'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

create policy "status_media_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'status-media'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

-- Expired rows are filtered out by RLS/query already, but they'll otherwise
-- accumulate forever. Optional cleanup if you have pg_cron enabled
-- (Dashboard → Database → Extensions → pg_cron), run once:
--
-- select cron.schedule('delete-expired-statuses', '0 * * * *', $$
--   delete from public.statuses where expires_at < now() - interval '1 day';
-- $$);
