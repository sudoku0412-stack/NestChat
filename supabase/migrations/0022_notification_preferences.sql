-- Per-category push notification toggles. The send-push edge function already fires three
-- distinct event types (messages/media/reactions) -- this just gates each on the recipient's own
-- preference instead of building new delivery infra.

alter table public.users
  add column if not exists notify_messages boolean not null default true,
  add column if not exists notify_media boolean not null default true,
  add column if not exists notify_reactions boolean not null default true;
