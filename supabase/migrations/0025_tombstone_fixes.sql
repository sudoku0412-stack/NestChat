-- Two gaps found reviewing 0021_account_deletion.sql after it had already been applied (fixed
-- here, not by editing 0021 in place, since it's live):
--
-- 1. `users_update_self` never got a `deleted_at is null` guard when tombstoning was introduced.
--    Tombstoning scrubs a row in place rather than deleting it, so the row still satisfies
--    `id = auth.uid()` for its own (still-valid, since signOut() is a client-side best-effort
--    step, not server-enforced) session -- meaning a just-deleted account could otherwise update
--    its own row back to non-null values, un-scrubbing itself.
-- 2. `_tombstone_user` walks a hardcoded list of tables FK'd to users.id, but that list predates
--    the broadcast_lists/broadcast_list_members/broadcast_sends/broadcast_send_targets tables
--    added in 0024_broadcast_lists.sql (same batch) -- a tombstoned user's id was surviving
--    forever in other people's saved broadcast lists, and could still receive a real message via
--    find_or_create_dm, which also has no deleted_at check.

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update to authenticated using (id = auth.uid() and deleted_at is null) with check (id = auth.uid());

create or replace function public._tombstone_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_key_members where user_id = target_id;
  delete from public.household_key_members where user_id = target_id;
  delete from public.chat_members where user_id = target_id;
  delete from public.message_reads where user_id = target_id;
  delete from public.message_stars where user_id = target_id;
  delete from public.message_reactions where user_id = target_id;
  delete from public.status_views where viewer_id = target_id;
  delete from public.statuses where user_id = target_id;
  delete from public.live_locations where user_id = target_id;
  delete from public.broadcast_list_members where member_id = target_id;
  delete from public.broadcast_lists where owner_id = target_id;
  delete from public.broadcast_send_targets where recipient_id = target_id;
  delete from public.broadcast_sends where sender_id = target_id;

  update public.users
  set deleted_at = now(),
      display_name = 'Deleted account',
      avatar_url = null,
      phone = null,
      email = null,
      pin_hash = null,
      push_token = null,
      public_key = null,
      key_updated_at = null,
      is_online = false,
      last_seen_at = null,
      role = 'member'
  where id = target_id;
end;
$$;

-- find_or_create_dm (0001_init.sql) never checked whether the other party is a live account --
-- harmless before tombstoning existed (a removed user's row was gone, so the FK insert itself
-- would fail), but now a tombstoned row still exists, so the insert would silently succeed.
create or replace function public.find_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  if exists (select 1 from public.users where id = other_user_id and deleted_at is not null) then
    raise exception 'Cannot message a deleted account';
  end if;

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
