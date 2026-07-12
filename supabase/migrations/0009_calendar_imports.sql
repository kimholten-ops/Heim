-- Importerte eksterne kalendere (skole/SFO/idrettslag) som speiles inn i events.
create table if not exists calendar_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  label text not null,
  source_url text not null,
  color text not null default '#7c5cff',
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references members(id),
  created_at timestamptz not null default now()
);

alter table events add column if not exists import_id uuid references calendar_imports(id) on delete cascade;
alter table events add column if not exists external_uid text;

create unique index if not exists events_import_external_uid
  on events(import_id, external_uid)
  where import_id is not null;

alter table calendar_imports enable row level security;

drop policy if exists "Members view calendar_imports" on calendar_imports;
create policy "Members view calendar_imports" on calendar_imports
  for select using (is_member(household_id));
drop policy if exists "Members insert calendar_imports" on calendar_imports;
create policy "Members insert calendar_imports" on calendar_imports
  for insert with check (is_member(household_id));
drop policy if exists "Members update calendar_imports" on calendar_imports;
create policy "Members update calendar_imports" on calendar_imports
  for update using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "Members delete calendar_imports" on calendar_imports;
create policy "Members delete calendar_imports" on calendar_imports
  for delete using (is_member(household_id));
