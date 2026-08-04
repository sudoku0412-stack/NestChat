-- Contact Info screen features: per-user "clear chat" and per-user, per-chat photo wallpaper.
-- Both are personal preferences, not shared state, so they live on chat_members (one row per
-- (chat, user)) rather than chats. chat_members_update_comember already lets any co-member
-- update any row in a chat they belong to (see 0001_init.sql) — that's a pre-existing, already
-- permissive design (matches "any member can invite/remove"). Client code must always scope its
-- own updates with `.eq('user_id', ...)`, same discipline the existing `muted` toggle already
-- follows, rather than tightening the policy here.

alter table public.chat_members add column if not exists cleared_at timestamptz;
alter table public.chat_members add column if not exists wallpaper_path text;

-- Storage: private bucket for per-user chat wallpapers.
-- Object path convention: {chat_id}/{user_id}/wallpaper-{timestamp}.{ext}
insert into storage.buckets (id, name, public)
values ('wallpapers', 'wallpapers', false)
on conflict (id) do nothing;

-- Anyone in the chat can see any member's chosen wallpaper (visible in shared UI context isn't a
-- concern here — same "any co-member can see" model as chat-media), but only the owner of that
-- second path segment can set/replace/remove their own.
create policy "wallpapers_select_member" on storage.objects
  for select to authenticated using (
    bucket_id = 'wallpapers'
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = (split_part(name, '/', 1))::uuid
        and cm.user_id = auth.uid()
    )
  );

create policy "wallpapers_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'wallpapers'
    and (split_part(name, '/', 2))::uuid = auth.uid()
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = (split_part(name, '/', 1))::uuid
        and cm.user_id = auth.uid()
    )
  );

create policy "wallpapers_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'wallpapers'
    and (split_part(name, '/', 2))::uuid = auth.uid()
  );
