-- Retter en feil i 0013: "notifications" fantes allerede fra 0004 (dokumentert
-- der som en tabell ingen app-kode noensinne skrev til — samme mønster som
-- household_members/invites/children som ble ryddet i 0005). Det gamle
-- skjemaet (recipient_id, payload jsonb, ingen member_id/url/ref_id) er
-- uforenlig med det 0013 faktisk trenger. "create table if not exists" i
-- 0013 ble derfor en stille no-op, og påfølgende create index/policy-
-- statements der kan ha feilet mot manglende kolonner.
--
-- Erstatter tabellen fullstendig — trygt siden den var ubrukt i appen.
drop table if exists notifications cascade;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text,
  url text,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedup_idx
  on notifications (member_id, type, ref_id) where ref_id is not null;
create index notifications_member_unread_idx
  on notifications (member_id, read_at, created_at desc);

alter table notifications enable row level security;

create policy "Recipients view own notifications" on notifications
  for select using (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  );
create policy "Household members insert notifications" on notifications
  for insert with check (is_member(household_id));
create policy "Recipients update own notifications" on notifications
  for update using (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  );
create policy "Recipients delete own notifications" on notifications
  for delete using (
    exists (select 1 from members where id = member_id and auth_user_id = (select auth.uid()))
  );

-- Behold realtime-oppføringen fra 0004 (droppet av "drop ... cascade" over).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
