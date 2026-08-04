-- Reply (quote a message when composing a new one) and Pin (one message pinned to the top of
-- the chat, visible to everyone in it — distinct from Star, which is private/per-user).
--
-- No new RLS needed: messages_insert_member already lets the sender insert with any additional
-- column value (RLS doesn't restrict per-column), and chats_update_member already lets any
-- co-member update any column on their chat's row (the same permissive model already relied on
-- for chat_members updates elsewhere in this app) — so setting pinned_message_id just works.

alter table public.messages add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;
alter table public.chats add column if not exists pinned_message_id uuid references public.messages(id) on delete set null;
