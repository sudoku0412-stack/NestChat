-- Per-user emoji reaction on a message (WhatsApp-style long-press reaction bar). Unlike
-- message_stars (private bookmark, select scoped to self), reactions are visible to every
-- co-member of the chat -- same visibility model as message_media, scoped through the parent
-- message's chat membership. One reaction per user per message: tapping a different emoji
-- replaces it (update), tapping the same one again removes it (delete) -- enforced by the
-- (message_id, user_id) primary key plus an upsert on write from the client.

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  reacted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create policy "message_reactions_select_member" on public.message_reactions
  for select to authenticated using (
    exists (
      select 1 from public.messages m
      join public.chat_members cm on cm.chat_id = m.chat_id
      where m.id = message_reactions.message_id and cm.user_id = auth.uid()
    )
  );

create policy "message_reactions_insert_self" on public.message_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      join public.chat_members cm on cm.chat_id = m.chat_id
      where m.id = message_reactions.message_id and cm.user_id = auth.uid()
    )
  );

create policy "message_reactions_update_self" on public.message_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "message_reactions_delete_self" on public.message_reactions
  for delete to authenticated using (user_id = auth.uid());
