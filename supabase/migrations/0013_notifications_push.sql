-- Varsler (in-app innboks) og web push (varsler når appen ikke er åpen).

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text,
  url text,
  -- Refererer til kilde-raden (f.eks. event-id) for idempotens: hindrer at
  -- samme påminnelse lages flere ganger når sjekken kjøres på nytt.
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists notifications_dedup_idx
  on notifications (member_id, type, ref_id) where ref_id is not null;
create index if not exists notifications_member_unread_idx
  on notifications (member_id, read_at, created_at desc);

alter table notifications enable row level security;

drop policy if exists "Recipients view own notifications" on notifications;
create policy "Recipients view own notifications" on notifications
  for select using (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  );
drop policy if exists "Household members insert notifications" on notifications;
create policy "Household members insert notifications" on notifications
  for insert with check (is_member(household_id));
drop policy if exists "Recipients update own notifications" on notifications;
create policy "Recipients update own notifications" on notifications
  for update using (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  );
drop policy if exists "Recipients delete own notifications" on notifications;
create policy "Recipients delete own notifications" on notifications
  for delete using (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  );

-- Push-abonnementer: knyttet til innlogget bruker (auth.uid()), ikke medlems-id,
-- siden ett abonnement er nettleser/enhet-spesifikt, ikke husstands-spesifikt.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on push_subscriptions;
create policy "Users manage own push subscriptions" on push_subscriptions
  for all using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));
