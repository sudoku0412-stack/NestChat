-- RPC backing the Chat List screen: one round trip for chat + last-message +
-- unread-count, instead of N+1 client-side queries. Runs as the caller
-- (security invoker, the default) so the existing RLS policies still apply.

create function public.get_chat_list()
returns table (
  chat_id uuid,
  type text,
  name text,
  avatar_url text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  last_message_has_media boolean,
  last_message_deleted boolean,
  unread_count bigint,
  muted boolean,
  archived boolean
)
language sql
stable
as $$
  select
    c.id as chat_id,
    c.type,
    c.name,
    c.avatar_url,
    lm.body as last_message_body,
    lm.created_at as last_message_at,
    lm.sender_id as last_message_sender_id,
    exists (select 1 from public.message_media mm where mm.message_id = lm.id) as last_message_has_media,
    (lm.deleted_at is not null) as last_message_deleted,
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
    cm.archived
  from public.chats c
  join public.chat_members cm on cm.chat_id = c.id and cm.user_id = auth.uid() and cm.archived = false
  left join lateral (
    select m.id, m.body, m.created_at, m.sender_id, m.deleted_at
    from public.messages m
    where m.chat_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

grant execute on function public.get_chat_list() to authenticated;

-- Marks every message in a chat up to "now" as read for the caller, by
-- pointing last_read_message_id at the newest message. Drives both the
-- unread badge and the sender-side "Read" receipt.
create function public.mark_chat_read(p_chat_id uuid)
returns void
language plpgsql
as $$
declare
  newest_id uuid;
begin
  select id into newest_id from public.messages
  where chat_id = p_chat_id
  order by created_at desc
  limit 1;

  if newest_id is not null then
    update public.chat_members
    set last_read_message_id = newest_id
    where chat_id = p_chat_id and user_id = auth.uid();

    insert into public.message_reads (message_id, user_id)
    select m.id, auth.uid()
    from public.messages m
    where m.chat_id = p_chat_id and m.sender_id <> auth.uid()
    on conflict (message_id, user_id) do nothing;
  end if;
end;
$$;

grant execute on function public.mark_chat_read(uuid) to authenticated;
