-- =====================================================================
-- 0005 – konsolider de to parallelle husholdningsmodellene til én.
--
--        0004 dokumenterte at household_members/invites/children/
--        event_children/allowance_* fantes i produksjon, men ingen
--        bruker-flyt i appen skrev noensinne til household_members —
--        add_child og set_active_household var derfor reelt sett
--        ødelagt (de leste fra en tabell ingen la rader i), og
--        "bytt husholdning" hadde ingen effekt siden layout.tsx kun
--        leser profiles.active_household_id.
--
--        Kanonisk modell etter denne migrasjonen: members +
--        household_invites + profiles.active_household_id (det
--        systemet resten av appen faktisk kjører på). Ingen reelle
--        brukere ennå, så dette gjøres som en ren opprydding uten
--        datamigrering.
-- =====================================================================

-- ---------- Fjern ubrukt lommepenge-funksjonalitet (ingen UI noensinne) ----------
drop function if exists public.approve_todo(uuid);
drop table if exists allowance_transactions;
drop table if exists savings_goals;
drop table if exists allowance_accounts;

alter table todos drop column if exists reward_points;
alter table todos drop column if exists approval_status;

-- ---------- event_members: konsolider til members (appen skrev allerede members.id inn her) ----------
alter table event_members drop constraint if exists event_members_user_id_fkey;
alter table event_members rename column user_id to member_id;
alter table event_members add constraint event_members_member_id_fkey
  foreign key (member_id) references members(id) on delete cascade;

-- event_children ble aldri skrevet til av appen (kun lest, ubrukt) — fjernes
drop table if exists event_children;

-- ---------- todos: én tildelingskolonne (assigned_to -> members), ikke to ----------
-- (GjoremalClient skrev allerede members.id i begge kolonner avhengig av rolle;
--  dette gjør skjemaet konsistent med det appen faktisk gjorde)
alter table todos drop constraint if exists todos_assigned_to_fkey;
alter table todos drop constraint if exists todos_assigned_to_child_id_fkey;
alter table todos drop column if exists assigned_to_child_id;
alter table todos add constraint todos_assigned_to_fkey
  foreign key (assigned_to) references members(id) on delete set null;

-- ---------- children: erstattet av members.role = 'child' (can_login = false) ----------
drop table if exists children;

-- ---------- Fjern RPC-er som pekte mot household_members og aldri kalles fra appen ----------
drop function if exists public.create_shopping_list(text, text);
drop function if exists public.create_todo_list(text, text, text);
drop function if exists public.generate_meal_shopping_list(date);

-- ---------- Fjern det aldri-populerte parallelle medlemskapssystemet ----------
drop table if exists household_members;
drop table if exists invites;

-- ---------- is_member(): trenger ikke lenger sjekke household_members ----------
create or replace function public.is_member(p_household_id uuid)
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
  );
$function$;

-- ---------- add_child(): skriv til members (slik appen faktisk representerer barn) ----------
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
  if not exists (select 1 from public.members where household_id = v_hid and auth_user_id = auth.uid()) then
    raise exception 'Ikke medlem';
  end if;
  insert into public.members (household_id, name, color, role, can_login)
    values (v_hid, p_name, coalesce(nullif(p_color,''), '#9333ea'), 'child', false)
    returning id into v_id;
  return v_id;
end;
$function$;

-- ---------- set_active_household(): oppdater profiles (det layout.tsx faktisk leser) ----------
create or replace function public.set_active_household(p_hid uuid)
 returns void
 language plpgsql
 security definer
as $function$
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  if not exists (select 1 from public.members where household_id = p_hid and auth_user_id = auth.uid()) then
    raise exception 'Du er ikke medlem av denne husholdningen';
  end if;
  update public.profiles set active_household_id = p_hid where id = auth.uid();
end;
$function$;

-- ---------- create_calendar_feed(): fjern household_members-fallback ----------
create or replace function public.create_calendar_feed(p_label text default 'Heim-kalender'::text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  v_hid   uuid;
  v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT active_household_id INTO v_hid
  FROM public.profiles WHERE id = v_uid;

  IF v_hid IS NULL THEN RAISE EXCEPTION 'Ingen aktiv husholdning'; END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.calendar_feeds (household_id, label, created_by, token)
  VALUES (v_hid, p_label, v_uid, v_token);

  RETURN v_token;
END;
$function$;
