-- get_chat_list() gains the last message's encryption columns so the client can decrypt the
-- chat-list preview itself once messages start being encrypted (Phase 2 of the E2EE rollout --
-- see HANDOVER.md). The server keeps returning last_message_body as-is (null for encrypted
-- messages, same as the messages table itself) -- there is no server-side decryption, ever.
--
-- Postgres won't let `create or replace function` add a column to `returns table(...)`, so the
-- old signature has to be dropped first (same gotcha as 0010).

drop function if exists public.get_chat_list(boolean);

create function public.get_chat_list(p_archived boolean default false)
returns table (
  chat_id uuid,
  type text,
  name text,
  avatar_url text,
  last_message_id uuid,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  last_message_has_media boolean,
  last_message_deleted boolean,
  last_message_enc_v smallint,
  last_message_key_id uuid,
  last_message_ciphertext text,
  unread_count bigint,
  muted boolean,
  archived boolean,
  favorite boolean
)
language sql
stable
as $$
  select
    c.id as chat_id,
    c.type,
    c.name,
    c.avatar_url,
    lm.id as last_message_id,
    lm.body as last_message_body,
    lm.created_at as last_message_at,
    lm.sender_id as last_message_sender_id,
    exists (select 1 from public.message_media mm where mm.message_id = lm.id) as last_message_has_media,
    (lm.deleted_at is not null) as last_message_deleted,
    lm.enc_v as last_message_enc_v,
    lm.key_id as last_message_key_id,
    lm.ciphertext as last_message_ciphertext,
    (
      select count(*)
      from public.messages m2
      where m2.chat_id = c.id
        and m2.sender_id <> auth.uid()
        and (
          cm.last_read_message_id is null
          or m2.created_at > (select m3.created_at from public.messages m3 where m3.id = cm.last_read_message_id)
        )
    ) as unread_count,
    cm.muted,
    cm.archived,
    cm.favorite
  from public.chats c
  join public.chat_members cm on cm.chat_id = c.id and cm.user_id = auth.uid() and cm.archived = p_archived
  left join lateral (
    select m.id, m.body, m.created_at, m.sender_id, m.deleted_at, m.enc_v, m.key_id, m.ciphertext
    from public.messages m
    where m.chat_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

grant execute on function public.get_chat_list(boolean) to authenticated;
