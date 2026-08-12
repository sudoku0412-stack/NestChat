-- Lists (named, reusable contact groups) + Broadcast messages (send once, fan out as
-- independent 1:1 messages -- recipients never see each other or know it was a broadcast, since
-- their own row is just a normal message in their own normal chat with the sender). No RPC
-- wrapper for list CRUD -- mirrors new-group.tsx's house style of plain insert/select under RLS.

create table public.broadcast_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.broadcast_list_members (
  list_id uuid not null references public.broadcast_lists(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, member_id)
);

-- One row per "hit send" event (list-based or ad-hoc). Deliberately holds no message content --
-- E2EE plaintext must never land server-side; the sender can always re-derive a preview by
-- decrypting one of their own fanned-out messages client-side, same as opening any normal chat.
create table public.broadcast_sends (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  list_id uuid references public.broadcast_lists(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Maps one broadcast_sends event to each fanned-out 1:1 message, so the sender's own "sent log"
-- can list recipients/status without inventing a new encryption scheme.
create table public.broadcast_send_targets (
  send_id uuid not null references public.broadcast_sends(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  primary key (send_id, recipient_id)
);

alter table public.broadcast_lists enable row level security;
alter table public.broadcast_list_members enable row level security;
alter table public.broadcast_sends enable row level security;
alter table public.broadcast_send_targets enable row level security;

-- Private to the owner/sender end-to-end -- recipients never see these tables at all, which is
-- what makes "recipients don't know it was a broadcast" true for free: they only ever see the
-- fanned-out row in their own normal messages/chat_members, exactly like any 1:1 DM.
create policy "broadcast_lists_select_owner" on public.broadcast_lists
  for select to authenticated using (owner_id = auth.uid());
create policy "broadcast_lists_insert_owner" on public.broadcast_lists
  for insert to authenticated with check (owner_id = auth.uid());
create policy "broadcast_lists_update_owner" on public.broadcast_lists
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "broadcast_lists_delete_owner" on public.broadcast_lists
  for delete to authenticated using (owner_id = auth.uid());

create policy "broadcast_list_members_select_owner" on public.broadcast_list_members
  for select to authenticated using (
    exists (select 1 from public.broadcast_lists bl where bl.id = list_id and bl.owner_id = auth.uid())
  );
create policy "broadcast_list_members_insert_owner" on public.broadcast_list_members
  for insert to authenticated with check (
    exists (select 1 from public.broadcast_lists bl where bl.id = list_id and bl.owner_id = auth.uid())
  );
create policy "broadcast_list_members_delete_owner" on public.broadcast_list_members
  for delete to authenticated using (
    exists (select 1 from public.broadcast_lists bl where bl.id = list_id and bl.owner_id = auth.uid())
  );

create policy "broadcast_sends_select_sender" on public.broadcast_sends
  for select to authenticated using (sender_id = auth.uid());
create policy "broadcast_sends_insert_sender" on public.broadcast_sends
  for insert to authenticated with check (sender_id = auth.uid());

create policy "broadcast_send_targets_select_sender" on public.broadcast_send_targets
  for select to authenticated using (
    exists (select 1 from public.broadcast_sends bs where bs.id = send_id and bs.sender_id = auth.uid())
  );
create policy "broadcast_send_targets_insert_sender" on public.broadcast_send_targets
  for insert to authenticated with check (
    exists (select 1 from public.broadcast_sends bs where bs.id = send_id and bs.sender_id = auth.uid())
  );
