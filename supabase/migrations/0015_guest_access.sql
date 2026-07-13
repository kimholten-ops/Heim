-- Gjestetilgang: et medlem kan inviteres inn med household_role 'gjest'
-- i stedet for 'medlem'. Gjester beholder full tilgang til kalenderen
-- (events/event_members bruker fortsatt is_member()/my_household_ids()
-- uendret), men mister skrivetilgang til lister, gjøremål og
-- familie-redigering (invitere, legge til barn, gi nytt navn).
--
-- Merk: "role" på members betyr noe annet (adult/child) og brukes til
-- visning i Familie-siden — household_role er en egen, ortogonal kolonne
-- for tilgangsnivå, for å unngå å blande sammen de to begrepene.

alter table members add column if not exists household_role text not null default 'medlem'
  check (household_role in ('medlem', 'gjest'));

alter table household_invites add column if not exists household_role text not null default 'medlem'
  check (household_role in ('medlem', 'gjest'));

create or replace function public.is_full_member(p_household_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.members
    where household_id = p_household_id
      and auth_user_id = (select auth.uid())
      and household_role = 'medlem'
  );
$function$;

create or replace function public.my_full_access_household_ids()
 returns setof uuid
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select household_id from public.members
  where auth_user_id = (select auth.uid()) and household_role = 'medlem';
$function$;

-- ---------- create_invite: velg hvilken rolle invitasjonen gir ----------
create or replace function public.create_invite(p_ttl_hours integer default 168, p_role text default 'medlem')
 returns text
 language plpgsql
 security definer
as $function$
declare hh uuid; t text; v_role text;
begin
  hh := public.current_household_id();
  if hh is null then raise exception 'Ingen aktiv husholdning'; end if;
  if not public.is_full_member(hh) then raise exception 'Kun fullverdige medlemmer kan invitere'; end if;
  v_role := case when p_role = 'gjest' then 'gjest' else 'medlem' end;
  loop
    t := public.gen_invite_token();
    exit when not exists (select 1 from public.household_invites where code = t);
  end loop;
  insert into public.household_invites (household_id, code, created_by, expires_at, household_role)
    values (hh, t, auth.uid(), now() + make_interval(hours => p_ttl_hours), v_role);
  return t;
end; $function$;

-- ---------- join_household: overfør rollen fra invitasjonen til medlemmet ----------
create or replace function public.join_household(p_code text)
 returns uuid
 language plpgsql
 security definer
as $function$
declare inv public.household_invites%rowtype; nm text;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  select * into inv from public.household_invites where code = upper(trim(p_code));
  if inv.id is null then raise exception 'Ugyldig invitasjonskode'; end if;
  if inv.used_at is not null then raise exception 'Koden er allerede brukt'; end if;
  if inv.expires_at < now() then raise exception 'Koden er utløpt'; end if;
  select coalesce(display_name,'Meg') into nm from public.profiles where id = auth.uid();
  if not exists (select 1 from public.members where household_id = inv.household_id and auth_user_id = auth.uid()) then
    insert into public.members (household_id, auth_user_id, name, color, role, household_role)
      values (inv.household_id, auth.uid(), coalesce(nm,'Meg'), '#f59e0b', 'adult', coalesce(inv.household_role, 'medlem'));
  end if;
  update public.household_invites set used_at = now() where id = inv.id;
  update public.profiles set active_household_id = inv.household_id where id = auth.uid();
  return inv.household_id;
end; $function$;

-- ---------- add_child / rename_member: krev fullverdig medlemskap ----------
create or replace function public.add_child(p_name text, p_color text default '#9333ea'::text)
 returns uuid
 language plpgsql
 security definer
as $function$
declare
  v_hid uuid;
  v_id  uuid;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  v_hid := public.current_household_id();
  if v_hid is null then raise exception 'Ingen aktiv husholdning'; end if;
  if not public.is_full_member(v_hid) then raise exception 'Kun fullverdige medlemmer kan legge til barn'; end if;
  insert into public.members (household_id, name, color, role, can_login)
    values (v_hid, p_name, coalesce(nullif(p_color,''), '#9333ea'), 'child', false)
    returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.rename_member(p_member_id uuid, p_name text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_hid uuid;
  v_name text := trim(p_name);
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  if v_name = '' then raise exception 'Navn kan ikke være tomt'; end if;

  select household_id into v_hid from public.members where id = p_member_id;
  if v_hid is null then raise exception 'Fant ikke medlem'; end if;

  if not public.is_full_member(v_hid) then
    raise exception 'Kun fullverdige medlemmer kan endre navn';
  end if;

  update public.members set name = v_name where id = p_member_id;
end;
$function$;

-- ---------- RLS: begrens lister/gjøremål/familie-redigering til fullverdige medlemmer ----------
-- members: alle (inkl. gjester) kan fortsatt SE medlemslisten (nødvendig for
-- kalender-tildeling m.m.), men bare fullverdige medlemmer kan skrive.
drop policy if exists "mine husholdninger - members" on members;
drop policy if exists "Medlemmer ser medlemslisten" on members;
create policy "Medlemmer ser medlemslisten" on members
  for select using (household_id in (select my_household_ids()));
drop policy if exists "Fullverdige medlemmer endrer medlemmer" on members;
create policy "Fullverdige medlemmer endrer medlemmer" on members
  for insert with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Fullverdige medlemmer oppdaterer medlemmer" on members;
create policy "Fullverdige medlemmer oppdaterer medlemmer" on members
  for update using (household_id in (select my_full_access_household_ids()))
  with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Fullverdige medlemmer sletter medlemmer" on members;
create policy "Fullverdige medlemmer sletter medlemmer" on members
  for delete using (household_id in (select my_full_access_household_ids()));

-- lister
drop policy if exists "mine husholdninger - lists" on lists;
create policy "mine husholdninger - lists" on lists
  for all using (household_id in (select my_full_access_household_ids()))
  with check (household_id in (select my_full_access_household_ids()));

drop policy if exists "mine husholdninger - list_items" on list_items;
create policy "mine husholdninger - list_items" on list_items
  for all using (list_id in (select id from lists where household_id in (select my_full_access_household_ids())))
  with check (list_id in (select id from lists where household_id in (select my_full_access_household_ids())));

-- gjøremål
drop policy if exists "Members delete todo lists" on todo_lists;
create policy "Members delete todo lists" on todo_lists
  for delete using (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members insert todo lists" on todo_lists;
create policy "Members insert todo lists" on todo_lists
  for insert with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members update todo lists" on todo_lists;
create policy "Members update todo lists" on todo_lists
  for update using (household_id in (select my_full_access_household_ids()))
  with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members view todo lists" on todo_lists;
create policy "Members view todo lists" on todo_lists
  for select using (household_id in (select my_full_access_household_ids()));

drop policy if exists "Members delete todos" on todos;
create policy "Members delete todos" on todos
  for delete using (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members insert todos" on todos;
create policy "Members insert todos" on todos
  for insert with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members update todos" on todos;
create policy "Members update todos" on todos
  for update using (household_id in (select my_full_access_household_ids()))
  with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members view todos" on todos;
create policy "Members view todos" on todos
  for select using (household_id in (select my_full_access_household_ids()));

-- roterende gjøremål (0012) følger samme begrensning som gjøremål for øvrig
drop policy if exists "Members view todo_rotations" on todo_rotations;
create policy "Members view todo_rotations" on todo_rotations
  for select using (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members insert todo_rotations" on todo_rotations;
create policy "Members insert todo_rotations" on todo_rotations
  for insert with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members update todo_rotations" on todo_rotations;
create policy "Members update todo_rotations" on todo_rotations
  for update using (household_id in (select my_full_access_household_ids()))
  with check (household_id in (select my_full_access_household_ids()));
drop policy if exists "Members delete todo_rotations" on todo_rotations;
create policy "Members delete todo_rotations" on todo_rotations
  for delete using (household_id in (select my_full_access_household_ids()));
