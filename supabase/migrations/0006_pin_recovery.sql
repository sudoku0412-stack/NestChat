-- Account recovery via PIN.
--
-- Anonymous auth (see lib/auth.tsx continueWithPhone) mints a brand-new
-- auth.uid() on every signInAnonymously() call, with no credential to log
-- back into the same identity. Signing out or reinstalling therefore
-- permanently orphans the old identity — the next login just creates a new
-- empty one. This adds a PIN tied to the phone number: on a later login with
-- the same phone, entering the correct PIN migrates all data from the old,
-- now-unreachable identity onto the fresh session instead of starting over.

create extension if not exists pgcrypto;

alter table public.users add column if not exists pin_hash text;

-- Does another row already claim this phone, and does it have a PIN set
-- (i.e. is recovery possible, vs. a pre-this-feature legacy account)?
create function public.check_phone_status(p_phone text)
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'exists', exists (select 1 from public.users where phone = p_phone and id <> auth.uid()),
    'has_pin', exists (
      select 1 from public.users where phone = p_phone and id <> auth.uid() and pin_hash is not null
    )
  );
$$;

-- Brand-new signup: stamp the phone + a hashed PIN onto the caller's own
-- (freshly anonymous) row. Relies on users.phone's unique constraint to
-- surface a 23505 if the number is somehow already taken (race with another
-- device) — lib/auth.tsx already handles that error code.
create function public.claim_phone(p_phone text, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits';
  end if;

  update public.users
  set phone = p_phone,
      pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = auth.uid();
end;
$$;

-- Existing logged-in user setting/changing their own recovery PIN (Settings).
create function public.set_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits';
  end if;

  update public.users set pin_hash = crypt(p_pin, gen_salt('bf')) where id = auth.uid();
end;
$$;

-- Recovery: verify the PIN against the old (orphaned) identity's hash, then
-- migrate every row it owns onto the caller's new auth.uid() and retire the
-- old one. FK columns with no ON DELETE action (chats.created_by,
-- messages.sender_id) must be reassigned before the delete, or it fails.
create function public.recover_account(p_phone text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  old_row public.users%rowtype;
  new_id uuid := auth.uid();
begin
  select * into old_row
  from public.users
  where phone = p_phone and id <> new_id
  limit 1;

  if old_row.id is null then
    raise exception 'No account found for that phone number';
  end if;

  if old_row.pin_hash is null then
    raise exception 'That account has no recovery PIN set';
  end if;

  if crypt(p_pin, old_row.pin_hash) <> old_row.pin_hash then
    return false;
  end if;

  update public.chats set created_by = new_id where created_by = old_row.id;
  update public.messages set sender_id = new_id where sender_id = old_row.id;
  update public.chat_members set user_id = new_id where user_id = old_row.id;
  update public.message_reads set user_id = new_id where user_id = old_row.id;
  update public.statuses set user_id = new_id where user_id = old_row.id;
  update public.status_views set viewer_id = new_id where viewer_id = old_row.id;
  update public.live_locations set user_id = new_id where user_id = old_row.id;

  update public.users
  set display_name = old_row.display_name,
      avatar_url = old_row.avatar_url,
      email = old_row.email,
      role = old_row.role,
      show_read_receipts = old_row.show_read_receipts,
      onboarding_completed = old_row.onboarding_completed,
      phone = p_phone,
      pin_hash = old_row.pin_hash
  where id = new_id;

  -- Cascades to delete the now-empty old public.users row.
  delete from auth.users where id = old_row.id;

  return true;
end;
$$;

grant execute on function public.check_phone_status(text) to authenticated;
grant execute on function public.claim_phone(text, text) to authenticated;
grant execute on function public.set_pin(text) to authenticated;
grant execute on function public.recover_account(text, text) to authenticated;
