-- recover_account was setting the new row's phone *before* deleting the old
-- row that still held it — old_row.phone and p_phone are the same value, so
-- the update collided with itself on users_phone_key. Fix: delete the old
-- (now FK-clear) row first, freeing the phone, then stamp it onto the new
-- one. old_row's fields are already captured in the PL/pgSQL variable, so
-- they're still available after the row itself is gone.
create or replace function public.recover_account(p_phone text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  old_row public.users%rowtype;
  new_id uuid := auth.uid();
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits';
  end if;

  select * into old_row
  from public.users
  where phone = p_phone and id <> new_id
  limit 1;

  if old_row.id is null then
    raise exception 'No account found for that phone number';
  end if;

  if old_row.pin_hash is not null and crypt(p_pin, old_row.pin_hash) <> old_row.pin_hash then
    return false;
  end if;

  update public.chats set created_by = new_id where created_by = old_row.id;
  update public.messages set sender_id = new_id where sender_id = old_row.id;
  update public.chat_members set user_id = new_id where user_id = old_row.id;
  update public.message_reads set user_id = new_id where user_id = old_row.id;
  update public.statuses set user_id = new_id where user_id = old_row.id;
  update public.status_views set viewer_id = new_id where viewer_id = old_row.id;
  update public.live_locations set user_id = new_id where user_id = old_row.id;

  -- Cascades to delete the now-empty old public.users row, freeing up p_phone
  -- (still unique) before we stamp it onto the new row below.
  delete from auth.users where id = old_row.id;

  update public.users
  set display_name = old_row.display_name,
      avatar_url = old_row.avatar_url,
      email = old_row.email,
      role = old_row.role,
      show_read_receipts = old_row.show_read_receipts,
      onboarding_completed = old_row.onboarding_completed,
      phone = p_phone,
      pin_hash = coalesce(old_row.pin_hash, crypt(p_pin, gen_salt('bf')))
  where id = new_id;

  return true;
end;
$$;

grant execute on function public.recover_account(text, text) to authenticated;
