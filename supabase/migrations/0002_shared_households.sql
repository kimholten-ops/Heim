-- =====================================================================
-- 0002 – delte husholdninger: invitasjonskode, profiler m/ aktiv
--        husholdning, bli-med / bytt-husholdning / legg-til-barn.
--        Trygg å kjøre på toppen av 0001 (idempotent).
-- =====================================================================

-- Invitasjonskode på hver husholdning
alter table households add column if not exists invite_code text unique;

-- Profil pr. innlogget bruker, med peker til aktiv husholdning.
-- (Lar samme person være medlem i flere husholdninger senere.)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active_household_id uuid references households(id) on delete set null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
drop policy if exists "egen profil" on profiles;
create policy "egen profil" on profiles for all using (id = auth.uid());

-- Husholdningene jeg er medlem i (security definer => ingen RLS-rekursjon)
create or replace function my_household_ids()
returns setof uuid language sql security definer stable as $$
  select household_id from members where auth_user_id = auth.uid();
$$;

-- Aktiv husholdning leses nå fra profilen
create or replace function current_household_id()
returns uuid language sql security definer stable as $$
  select active_household_id from profiles where id = auth.uid();
$$;

create or replace function gen_invite_code()
returns text language sql as $$ select upper(substr(md5(random()::text), 1, 6)); $$;

-- Bredere RLS: se data for alle husholdninger jeg er medlem i
drop policy if exists "egen husholdning - households" on households;
drop policy if exists "mine husholdninger - households" on households;
create policy "mine husholdninger - households" on households
  for all using (id in (select my_household_ids()));

drop policy if exists "egen husholdning - members" on members;
drop policy if exists "mine husholdninger - members" on members;
create policy "mine husholdninger - members" on members
  for all using (household_id in (select my_household_ids()));

drop policy if exists "egen husholdning - lists" on lists;
drop policy if exists "mine husholdninger - lists" on lists;
create policy "mine husholdninger - lists" on lists
  for all using (household_id in (select my_household_ids()));

drop policy if exists "egen husholdning - list_items" on list_items;
drop policy if exists "mine husholdninger - list_items" on list_items;
create policy "mine husholdninger - list_items" on list_items
  for all using (
    list_id in (select id from lists where household_id in (select my_household_ids()))
  );

-- Ny bruker: profil + husholdning m/ kode + medlem + handleliste
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare hh uuid; nm text;
begin
  nm := coalesce(new.raw_user_meta_data->>'name','Meg');
  insert into households (name, invite_code) values ('Min husholdning', gen_invite_code()) returning id into hh;
  insert into members (household_id, auth_user_id, name, color, role)
    values (hh, new.id, nm, '#0d9488', 'adult');
  insert into lists (household_id, name, type) values (hh, 'Handleliste', 'shopping');
  insert into profiles (id, display_name, active_household_id) values (new.id, nm, hh)
    on conflict (id) do update set active_household_id = excluded.active_household_id;
  return new;
end; $$;

-- Bli med i en husholdning via kode
create or replace function join_household(p_code text)
returns uuid language plpgsql security definer as $$
declare hh uuid; nm text;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  select id into hh from households where invite_code = upper(trim(p_code));
  if hh is null then raise exception 'Ugyldig invitasjonskode'; end if;
  select coalesce(display_name,'Meg') into nm from profiles where id = auth.uid();
  if not exists (select 1 from members where household_id = hh and auth_user_id = auth.uid()) then
    insert into members (household_id, auth_user_id, name, color, role)
      values (hh, auth.uid(), coalesce(nm,'Meg'), '#f59e0b', 'adult');
  end if;
  update profiles set active_household_id = hh where id = auth.uid();
  return hh;
end; $$;

-- Bytt aktiv husholdning (må være medlem)
create or replace function set_active_household(p_hid uuid)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from members where household_id = p_hid and auth_user_id = auth.uid()) then
    raise exception 'Du er ikke medlem av denne husholdningen';
  end if;
  update profiles set active_household_id = p_hid where id = auth.uid();
end; $$;

-- Legg til et barn (uten innlogging) i aktiv husholdning
create or replace function add_child(p_name text, p_color text)
returns uuid language plpgsql security definer as $$
declare hh uuid; mid uuid;
begin
  hh := current_household_id();
  if hh is null then raise exception 'Ingen aktiv husholdning'; end if;
  if not exists (select 1 from members where household_id = hh and auth_user_id = auth.uid()) then
    raise exception 'Ikke medlem';
  end if;
  insert into members (household_id, name, color, role, can_login)
    values (hh, p_name, coalesce(nullif(p_color,''),'#9333ea'), 'child', false)
    returning id into mid;
  return mid;
end; $$;

-- ---------- Etterfylling for data laget med 0001 ----------
update households set invite_code = gen_invite_code() where invite_code is null;

insert into profiles (id, display_name, active_household_id)
  select distinct on (m.auth_user_id) m.auth_user_id, m.name, m.household_id
  from members m
  where m.auth_user_id is not null
  order by m.auth_user_id, m.created_at
  on conflict (id) do nothing;
