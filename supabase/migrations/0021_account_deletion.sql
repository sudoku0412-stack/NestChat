-- Self-service account deletion (Apple Guideline 5.1.1v requires an in-app path before any
-- public listing). Tombstone, not hard-delete: messages.sender_id is `not null references
-- users(id)` with no `on delete` action (RESTRICT), so hard-deleting a user who has ever sent a
-- message throws a live FK violation -- which is exactly the latent bug in
-- remove_household_member below, fixed here by routing both removal paths through one helper.
-- Keeping the row (scrubbed) means every existing join (sender_id, created_by) keeps resolving
-- with zero new "unknown sender" UI -- the row's own display_name just becomes "Deleted account".

alter table public.users add column if not exists deleted_at timestamptz;

-- Internal only (not granted to anyone directly) -- walks every table FK'd to users.id that
-- would otherwise cascade-delete if the row itself were removed, then scrubs + tombstones it.
create function public._tombstone_user(target_id uuid)
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

-- Admin-removes-someone-else -- was `delete from public.users where id = target_user_id`, which
-- throws a FK violation the first time the removed member has ever sent a message (RESTRICT on
-- messages.sender_id). Now delegates to the shared tombstone helper instead.
create or replace function public.remove_household_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
    raise exception 'Only admins can remove household members';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Use delete_own_account to remove yourself';
  end if;
  perform public._tombstone_user(target_user_id);
end;
$$;

-- Self-service deletion. Blocks a sole admin from deleting themselves into a headless
-- household -- same "at least one admin must exist" spirit as 0001's original setup.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_role text;
  other_admins int;
begin
  select role into my_role from public.users where id = auth.uid() and deleted_at is null;
  if my_role is null then
    raise exception 'No active account for caller';
  end if;

  if my_role = 'admin' then
    select count(*) into other_admins
    from public.users
    where role = 'admin' and deleted_at is null and id <> auth.uid();
    if other_admins = 0 then
      raise exception 'Promote another member to admin before deleting the last admin account';
    end if;
  end if;

  perform public._tombstone_user(auth.uid());
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
