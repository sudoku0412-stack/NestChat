-- notify_send_push() (the `messages` INSERT trigger -> send-push edge function) currently only
-- forwards id/chat_id/sender_id/body. Once messages can be encrypted (E2EE Phase 2b), an
-- encrypted message also has body = null -- same as a media placeholder row -- so the edge
-- function can no longer tell them apart without enc_v in the payload. This is a `returns
-- trigger` function, not `returns table(...)`, so create-or-replace can change its body directly,
-- no drop/recreate needed (unlike get_chat_list's return-type gotcha in 0010/0019).
--
-- IMPORTANT: replace YOUR_SERVICE_ROLE_JWT_HERE with the same bearer token already in the
-- existing notify_send_push definition (Database -> Functions -> notify_send_push -> view
-- definition) before running this in the SQL Editor. Never commit the real token to this file.

create or replace function public.notify_send_push()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://hfmjigdtmjbgyqcnneqt.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_JWT_HERE'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'record', jsonb_build_object(
        'id', new.id,
        'chat_id', new.chat_id,
        'sender_id', new.sender_id,
        'body', new.body,
        'enc_v', new.enc_v
      )
    )
  );
  return new;
end;
$$;
