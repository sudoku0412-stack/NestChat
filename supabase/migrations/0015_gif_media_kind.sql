-- Widen message_media.kind again (see 0005_documents_and_live_location.sql) to allow 'gif' --
-- GIFs/stickers picked from the Giphy picker are stored through the same upload pipeline as
-- photos/videos, just tagged with their own kind so the client knows not to re-compress them
-- (see prepareForUpload in lib/media.ts) and to skip the video play-button overlay.

alter table public.message_media drop constraint if exists message_media_kind_check;
alter table public.message_media add constraint message_media_kind_check
  check (kind in ('photo', 'video', 'document', 'gif'));
