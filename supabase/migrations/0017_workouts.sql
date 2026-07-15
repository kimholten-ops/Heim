-- Treningsmodul: globalt øvelsesbibliotek + privat mal/økt-logging per medlem.
-- Kun voksne (members.role = 'adult') bruker denne modulen i UI, men det
-- håndheves ikke i RLS — treningsdata er allerede privat per medlem
-- (my_member_ids()), og aldersrollen er en visningsdetalj, ikke en
-- sikkerhetsgrense.

-- ---------- Øvelsesbibliotek (delt, globalt, ingen household_id) ----------
create table if not exists exercises (
  id text primary key,
  name_no text not null,
  name_en text not null,
  muscle_groups text[] not null,
  equipment text,
  level text,
  instructions_no jsonb not null default '[]',
  image_urls jsonb not null default '[]'
);

alter table exercises enable row level security;

drop policy if exists "Innloggede leser øvelsesbiblioteket" on exercises;
create policy "Innloggede leser øvelsesbiblioteket" on exercises
  for select using (auth.uid() is not null);
-- Ingen insert/update/delete-policy: biblioteket skrives kun av
-- scripts/seed-exercises.mjs (service-role, kjøres manuelt av utvikler).

-- ---------- Privat-mønster: medlems-id-ene til innlogget bruker ----------
-- (tilsvarer my_household_ids()/is_member(), men for personlig eide rader
-- som ikke skal deles med resten av husstanden.)
create or replace function public.my_member_ids()
 returns setof uuid
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select id from public.members where auth_user_id = (select auth.uid());
$function$;

-- ---------- Treningsmaler ----------
create table if not exists workout_templates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id text not null references exercises(id),
  position int not null default 0,
  target_sets int,
  target_reps text,
  notes text
);

-- ---------- Økter ----------
create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  template_id uuid references workout_templates(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  -- Settes til null automatisk (via FK) hvis kalenderhendelsen slettes,
  -- uten at det krasjer noe her. Motsatt retning (slett økt -> slett
  -- hendelse) håndteres i appkoden siden Postgres-FK ikke kan kaskadere
  -- den veien.
  calendar_event_id uuid references events(id) on delete set null
);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id text not null references exercises(id),
  set_number int not null,
  reps int,
  weight_kg numeric(6,2),
  completed boolean not null default true
);

create index if not exists workout_sets_session_exercise_idx on workout_sets (session_id, exercise_id);
create index if not exists workout_sessions_member_started_idx on workout_sessions (member_id, started_at desc);

alter table workout_templates enable row level security;
alter table workout_template_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_sets enable row level security;

drop policy if exists "Eier egne maler" on workout_templates;
create policy "Eier egne maler" on workout_templates
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));

drop policy if exists "Eier egne mal-øvelser" on workout_template_exercises;
create policy "Eier egne mal-øvelser" on workout_template_exercises
  for all using (template_id in (select id from workout_templates where member_id in (select my_member_ids())))
  with check (template_id in (select id from workout_templates where member_id in (select my_member_ids())));

drop policy if exists "Eier egne økter" on workout_sessions;
create policy "Eier egne økter" on workout_sessions
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));

drop policy if exists "Eier egne sett" on workout_sets;
create policy "Eier egne sett" on workout_sets
  for all using (session_id in (select id from workout_sessions where member_id in (select my_member_ids())))
  with check (session_id in (select id from workout_sessions where member_id in (select my_member_ids())));
