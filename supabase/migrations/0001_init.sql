-- =====================================================================
-- 0001 – grunnskjema: husholdning, medlemmer, lister, sanntid, RLS
-- =====================================================================
create extension if not exists "pgcrypto";

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#0d9488',
  role text not null default 'adult' check (role in ('adult','child','guest')),
  can_login boolean default true,
  created_at timestamptz default now()
);

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null default 'shopping' check (type in ('shopping','custom')),
  created_at timestamptz default now()
);

create table if not exists list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  assignee_id uuid references members(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function current_household_id()
returns uuid language sql security definer stable as $$
  select household_id from members where auth_user_id = auth.uid() limit 1;
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare hh uuid;
begin
  insert into households (name) values ('Min husholdning') returning id into hh;
  insert into members (household_id, auth_user_id, name, color, role)
    values (hh, new.id, coalesce(new.raw_user_meta_data->>'name','Meg'), '#0d9488', 'adult');
  insert into lists (household_id, name, type) values (hh, 'Handleliste', 'shopping');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

alter table households  enable row level security;
alter table members     enable row level security;
alter table lists       enable row level security;
alter table list_items  enable row level security;

drop policy if exists "egen husholdning - households" on households;
create policy "egen husholdning - households" on households
  for all using (id = current_household_id());

drop policy if exists "egen husholdning - members" on members;
create policy "egen husholdning - members" on members
  for all using (household_id = current_household_id());

drop policy if exists "egen husholdning - lists" on lists;
create policy "egen husholdning - lists" on lists
  for all using (household_id = current_household_id());

drop policy if exists "egen husholdning - list_items" on list_items;
create policy "egen husholdning - list_items" on list_items
  for all using (
    list_id in (select id from lists where household_id = current_household_id())
  );

alter publication supabase_realtime add table list_items;
