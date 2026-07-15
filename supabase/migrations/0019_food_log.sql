-- Kosthold fase 2: daglig matlogging (privat per medlem, samme mønster som
-- workout_sessions/weight_entries — my_member_ids() fra 0017).
--
-- Én rad kan komme fra tre kilder (alltid nøyaktig én av dem faktisk brukt,
-- håndhevet i appkoden — ikke i DB, siden det ikke gir noen sikkerhetsfordel
-- her og en check-constraint ville låst formatet unødig hardt):
--   1) matvare_id -> matvarer (Matvaretabellen)
--   2) product    -> et snapshot av et Kassalapp-produktoppslag på loggetidspunktet
--   3) custom_name -> fritekst med manuelt anslåtte verdier
-- kcal/protein_g/karbo_g/fett_g er alltid denormalisert inn ved innsetting
-- (allerede skalert til antall gram), slik at dagssummer kun krever én
-- SELECT mot denne tabellen — ikke et join mot matvarer ved hver visning.
-- matvare_navn er denormalisert av samme grunn: visningsnavnet skal ikke
-- kreve et oppslag mot matvarer for hver rad som vises.
create table if not exists food_log_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  date date not null,
  slot text not null default 'annet' check (slot in ('frokost','lunsj','middag','kvelds','annet')),
  matvare_id text references matvarer(id),
  matvare_navn text,
  product jsonb,
  custom_name text,
  grams numeric(7,1) not null default 100,
  kcal numeric(7,1) not null,
  protein_g numeric(6,1) not null default 0,
  karbo_g numeric(6,1) not null default 0,
  fett_g numeric(6,1) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists food_log_entries_member_date_idx on food_log_entries (member_id, date);

alter table food_log_entries enable row level security;

drop policy if exists "Eier egen matlogg" on food_log_entries;
create policy "Eier egen matlogg" on food_log_entries
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));
