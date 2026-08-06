-- Widen message_media.kind once more (see 0005, 0015) to allow 'sticker', kept distinct from
-- 'gif' purely so notifications and labels can say "Sticker" vs "GIF" -- both come from the
-- same Giphy picker and are stored identically otherwise.

alter table public.message_media drop constraint if exists message_media_kind_check;
alter table public.message_media add constraint message_media_kind_check
  check (kind in ('photo', 'video', 'document', 'gif', 'sticker'));
