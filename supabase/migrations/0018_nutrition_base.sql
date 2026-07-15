-- Kosthold fase 1: matvaretabell (delt, globalt), mål og vektlogg (privat
-- per medlem, samme mønster som treningsmodulen i 0017 — my_member_ids()).

create extension if not exists pg_trgm;

-- ---------- Matvaretabellen (delt, globalt, ingen household_id) ----------
create table if not exists matvarer (
  id text primary key,
  navn text not null,
  gruppe text,
  kcal numeric(7,1) not null,
  protein_g numeric(6,1) not null default 0,
  karbo_g numeric(6,1) not null default 0,
  fett_g numeric(6,1) not null default 0,
  fiber_g numeric(6,1) not null default 0
);

create index if not exists matvarer_navn_trgm_idx on matvarer using gin (navn gin_trgm_ops);

alter table matvarer enable row level security;

drop policy if exists "Innloggede leser matvaretabellen" on matvarer;
create policy "Innloggede leser matvaretabellen" on matvarer
  for select using (auth.uid() is not null);
-- Ingen insert/update/delete-policy: tabellen skrives kun av
-- scripts/seed-matvarer.mjs (service-role, kjøres manuelt av utvikler).

-- ---------- Mål (privat per medlem) ----------
create table if not exists health_profiles (
  member_id uuid primary key references members(id) on delete cascade,
  kcal_target int,
  protein_target_g int,
  updated_at timestamptz not null default now()
);

alter table health_profiles enable row level security;

drop policy if exists "Eier eget helsemål" on health_profiles;
create policy "Eier eget helsemål" on health_profiles
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));

-- ---------- Vektlogg (privat per medlem) ----------
create table if not exists weight_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null,
  unique (member_id, date)
);

create index if not exists weight_entries_member_date_idx on weight_entries (member_id, date desc);

alter table weight_entries enable row level security;

drop policy if exists "Eier egen vektlogg" on weight_entries;
create policy "Eier egen vektlogg" on weight_entries
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));
