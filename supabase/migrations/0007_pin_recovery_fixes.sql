-- Fixes to 0006_pin_recovery.sql's flow, found during real device testing:
--
-- 1. "Junk accounts appearing": the client used to call signInAnonymously()
--    just to check whether a phone number existed, before the user had
--    decided to sign up or recover anything. Every abandoned attempt (typo,
--    killed app, backed out) left a permanent empty "New Member" row behind.
--    Fix: check_phone_status no longer needs a session at all (granted to
--    `anon`), and a new verify_recovery_pin lets a PIN attempt be checked
--    without one either. A session is now only created at the moment of an
--    actual claim/recover, and delete_self() cleans up if that then fails.
--
-- 2. "Recovery not working / waiting on an admin": recover_account used to
--    hard-fail if the matched account had never had a PIN set (any account
--    created before this feature shipped, including admins). Fix: if
--    pin_hash is null, any PIN is accepted and becomes the account's new
--    one — consistent with the app's existing no-SMS-OTP security model,
--    where the phone number itself was never verified either.

-- check_phone_status no longer needs to exclude "myself" — the client calls
-- it before any session exists now, so there's no "myself" yet.
create or replace function public.check_phone_status(p_phone text)
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'exists', exists (select 1 from public.users where phone = p_phone),
    'has_pin', exists (select 1 from public.users where phone = p_phone and pin_hash is not null)
  );
$$;

grant execute on function public.check_phone_status(text) to anon, authenticated;

-- Pure verification, callable with no session — lets the client rule out a
-- wrong PIN before ever creating (and having to clean up) an anonymous
-- session. Returns true if the phone has no account (nothing to check
-- against — recover_account will raise on that instead), or if it has no
-- PIN set yet (any PIN is accepted and becomes the new one), or if the PIN
-- matches the existing hash.
create function public.verify_recovery_pin(p_phone text, p_pin text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  old_hash text;
begin
  select pin_hash into old_hash from public.users where phone = p_phone limit 1;
  if old_hash is null then
    return true;
  end if;
  return crypt(p_pin, old_hash) = old_hash;
end;
$$;

grant execute on function public.verify_recovery_pin(text, text) to anon, authenticated;

-- Cleanup safety net: lets a just-created, not-yet-claimed anonymous session
-- delete itself if a claim/recover attempt then fails. Cascades to delete
-- the (still phone-less, still dataless) public.users row too.
create function public.delete_self()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_self() to authenticated;

-- Recovery no longer dead-ends on accounts with no PIN set — it lets the
-- caller's just-provided PIN become that account's PIN as part of the same
-- migration, instead of requiring an admin to intervene first.
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

  -- Cascades to delete the now-empty old public.users row.
  delete from auth.users where id = old_row.id;

  return true;
end;
$$;

grant execute on function public.recover_account(text, text) to authenticated;
