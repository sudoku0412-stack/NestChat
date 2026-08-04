-- Per-user "star a message" bookmark (WhatsApp-style). Same (message_id, user_id) shape as
-- message_reads, but with two deliberate differences: select is restricted to the caller's own
-- row (nobody should see who starred what — reads are a receipt, meant to be visible; stars are
-- a private bookmark), and there's a delete policy (unstarring removes the row; reads never get
-- un-read, so that table has no delete policy to mirror).

create table public.message_stars (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  starred_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_stars enable row level security;

create policy "message_stars_select_self" on public.message_stars
  for select to authenticated using (user_id = auth.uid());

create policy "message_stars_insert_self" on public.message_stars
  for insert to authenticated with check (user_id = auth.uid());

create policy "message_stars_delete_self" on public.message_stars
  for delete to authenticated using (user_id = auth.uid());
