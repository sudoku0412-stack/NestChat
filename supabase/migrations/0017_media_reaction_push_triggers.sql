-- Two more trigger functions alongside the existing notify_send_push() (which is hardcoded to
-- the `messages` table's own columns and can't be reused as-is for message_media/message_reactions
-- -- their rows don't have chat_id/body, so reusing it verbatim would error or send garbage).
-- Same net.http_post-to-the-edge-function shape, just built from each table's own columns.
--
-- IMPORTANT: replace YOUR_SERVICE_ROLE_JWT_HERE below with the same bearer token already baked
-- into notify_send_push() (Database -> Functions -> notify_send_push -> view definition) before
-- running this in the SQL Editor. Never commit the real token to this file.

create or replace function public.notify_send_push_media()
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
      'table', 'message_media',
      'record', jsonb_build_object(
        'message_id', new.message_id,
        'kind', new.kind,
        'file_name', new.file_name
      )
    )
  );
  return new;
end;
$$;

drop trigger if exists send_push_on_media on public.message_media;
create trigger send_push_on_media
  after insert on public.message_media
  for each row execute function public.notify_send_push_media();

create or replace function public.notify_send_push_reaction()
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
      'type', TG_OP,
      'table', 'message_reactions',
      'record', jsonb_build_object(
        'message_id', new.message_id,
        'user_id', new.user_id,
        'emoji', new.emoji
      )
    )
  );
  return new;
end;
$$;

drop trigger if exists send_push_on_reaction on public.message_reactions;
create trigger send_push_on_reaction
  after insert or update on public.message_reactions
  for each row execute function public.notify_send_push_reaction();
