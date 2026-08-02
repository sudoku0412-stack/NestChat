-- Fixes "infinite recursion detected in policy for relation chat_members".
-- Three chat_members policies queried chat_members from inside their own
-- policy definition; Postgres re-applies the same policy to that inner query,
-- recursing forever. A security-definer function bypasses RLS for just that
-- inner "am I a member of this chat" lookup. Run this once against an
-- existing project that already has 0001_init.sql applied — a fresh project
-- can just run the updated 0001_init.sql instead.

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

drop policy if exists "chat_members_select_comember" on public.chat_members;
create policy "chat_members_select_comember" on public.chat_members
  for select to authenticated using (
    public.is_chat_member(chat_members.chat_id, auth.uid())
  );

drop policy if exists "chat_members_update_comember" on public.chat_members;
create policy "chat_members_update_comember" on public.chat_members
  for update to authenticated using (
    public.is_chat_member(chat_members.chat_id, auth.uid())
  );

drop policy if exists "chat_members_delete_comember" on public.chat_members;
create policy "chat_members_delete_comember" on public.chat_members
  for delete to authenticated using (
    public.is_chat_member(chat_members.chat_id, auth.uid())
  );
