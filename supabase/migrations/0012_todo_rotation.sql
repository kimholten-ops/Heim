-- Roterende gjøremål: automatisk rotasjon av ansvarlig mellom valgte medlemmer.
create table if not exists todo_rotations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  todo_list_id uuid not null references todo_lists(id) on delete cascade,
  title text not null,
  member_order uuid[] not null,
  current_index int not null default 0,
  frequency text not null default 'weekly' check (frequency in ('daily','weekly')),
  next_due date not null,
  active boolean not null default true,
  created_by uuid references members(id),
  created_at timestamptz not null default now()
);

alter table todos add column if not exists rotation_id uuid references todo_rotations(id) on delete set null;

-- Hindrer dobbel-generering av samme runde dersom to familiemedlemmer
-- åpner appen samtidig og begge trigger sjekken (race condition).
create unique index if not exists todos_rotation_due_uniq
  on todos (rotation_id, due_date) where rotation_id is not null;

alter table todo_rotations enable row level security;

drop policy if exists "Members view todo_rotations" on todo_rotations;
create policy "Members view todo_rotations" on todo_rotations
  for select using (is_member(household_id));
drop policy if exists "Members insert todo_rotations" on todo_rotations;
create policy "Members insert todo_rotations" on todo_rotations
  for insert with check (is_member(household_id));
drop policy if exists "Members update todo_rotations" on todo_rotations;
create policy "Members update todo_rotations" on todo_rotations
  for update using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "Members delete todo_rotations" on todo_rotations;
create policy "Members delete todo_rotations" on todo_rotations
  for delete using (is_member(household_id));
