-- =====================================================================
-- 0004 – synkroniser migrasjonssporet med det faktiske skjemaet i
--        produksjon. Disse endringene er allerede utført direkte i
--        Supabase (utenom migrasjonshistorikken) – denne filen er kun
--        idempotente create/replace-setninger, ingenting destruktivt,
--        slik at 0001→0004 reproduserer dagens skjema fra bunnen av.
--
--        Merk: household_members/invites lever parallelt med
--        members/household_invites fra 0001–0003 (begge brukes –
--        is_member() sjekker begge). Dette er reell drift i
--        produksjon, ikke noe denne migrasjonen prøver å rydde opp i.
-- =====================================================================

-- ---------- Manglende kolonne på eksisterende tabell ----------
alter table households add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ---------- Nye tabeller (i avhengighetsrekkefølge) ----------

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  active_household boolean default false,
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  code text not null unique default substr(md5(random()::text), 1, 8),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  color text not null default '#6366f1',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  location text,
  notes text,
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly','yearly'))
);

create table if not exists event_members (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (event_id, user_id)
);

create table if not exists event_children (
  event_id uuid not null references events(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  primary key (event_id, child_id)
);

create table if not exists calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  label text not null default 'Husholdningskalender',
  member_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists todo_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text not null default '✅',
  color text not null default '#6366f1',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  todo_list_id uuid not null references todo_lists(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  assigned_to uuid references auth.users(id) on delete set null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  reward_points integer not null default 0,
  approval_status text not null default 'none' check (approval_status in ('none','pending','approved','rejected')),
  assigned_to_child_id uuid references children(id) on delete set null
);

create table if not exists shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text not null default '🛒',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  checked boolean default false,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  shopping_list_id uuid references shopping_lists(id) on delete cascade
);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  body text,
  url text,
  ingredients jsonb not null default '[]',
  times_used integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  recipe_id uuid references recipes(id) on delete set null,
  title text,
  cook_id uuid references members(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (household_id, date)
);

create table if not exists allowance_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid references auth.users(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  display_name text,
  weekly_base integer not null default 0,
  balance integer not null default 0,
  payday text not null default 'sunday' check (payday in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  check (member_id is not null or child_id is not null)
);

create table if not exists allowance_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references allowance_accounts(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('weekly_base','todo_bonus','manual','spend')),
  todo_id uuid references todos(id) on delete set null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references allowance_accounts(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  target_amount integer not null,
  saved_amount integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- RLS på de nye tabellene ----------
alter table household_members     enable row level security;
alter table invites               enable row level security;
alter table children              enable row level security;
alter table events                enable row level security;
alter table event_members         enable row level security;
alter table event_children        enable row level security;
alter table calendar_feeds        enable row level security;
alter table todo_lists            enable row level security;
alter table todos                 enable row level security;
alter table shopping_lists        enable row level security;
alter table shopping_items        enable row level security;
alter table recipes               enable row level security;
alter table meals                 enable row level security;
alter table allowance_accounts    enable row level security;
alter table allowance_transactions enable row level security;
alter table savings_goals         enable row level security;
alter table notifications         enable row level security;

-- ---------- Funksjoner (create or replace = trygt å kjøre på nytt) ----------

create or replace function public.add_child(p_name text, p_color text default '#6366f1'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_household_id uuid;
  v_child_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select household_id into v_household_id
  from public.household_members
  where user_id = v_uid and active_household = true;

  if v_household_id is null then raise exception 'No active household'; end if;

  insert into public.children (household_id, name, color)
  values (v_household_id, p_name, p_color)
  returning id into v_child_id;

  return v_child_id;
end;
$function$;

create or replace function public.approve_todo(p_todo_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_todo public.todos; v_acct_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_todo FROM public.todos WHERE id = p_todo_id;
  IF v_todo.id IS NULL THEN RAISE EXCEPTION 'Todo not found'; END IF;
  IF NOT public.is_member(v_todo.household_id) THEN RAISE EXCEPTION 'Not a member'; END IF;

  UPDATE public.todos SET approval_status = 'approved' WHERE id = p_todo_id;

  IF v_todo.reward_points > 0 AND v_todo.assigned_to IS NOT NULL THEN
    SELECT id INTO v_acct_id FROM public.allowance_accounts
    WHERE member_id = v_todo.assigned_to AND household_id = v_todo.household_id;
    IF v_acct_id IS NOT NULL THEN
      INSERT INTO public.allowance_transactions (account_id, household_id, amount, kind, todo_id, description, created_by)
      VALUES (v_acct_id, v_todo.household_id, v_todo.reward_points, 'todo_bonus', p_todo_id, 'Gjøremål: ' || v_todo.title, v_uid);
      UPDATE public.allowance_accounts SET balance = balance + v_todo.reward_points WHERE id = v_acct_id;
    END IF;
  END IF;
END;
$function$;

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

  -- Heim: read from profiles.active_household_id
  SELECT active_household_id INTO v_hid
  FROM public.profiles WHERE id = v_uid;

  -- Fallback: CC-style
  IF v_hid IS NULL THEN
    SELECT household_id INTO v_hid
    FROM public.household_members
    WHERE user_id = v_uid AND active_household = true;
  END IF;

  IF v_hid IS NULL THEN RAISE EXCEPTION 'Ingen aktiv husholdning'; END IF;

  -- Generate token explicitly (avoid 'base64url' which is unsupported in older PG)
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.calendar_feeds (household_id, label, created_by, token)
  VALUES (v_hid, p_label, v_uid, v_token);

  RETURN v_token;
END;
$function$;

create or replace function public.create_household(p_name text)
 returns uuid
 language plpgsql
 security definer
as $function$
declare hh uuid; nm text;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  select coalesce(display_name,'Meg') into nm from public.profiles where id = auth.uid();
  insert into public.households (name, invite_code)
    values (coalesce(nullif(p_name,''),'Min husholdning'), public.gen_invite_code())
    returning id into hh;
  insert into public.members (household_id, auth_user_id, name, color, role)
    values (hh, auth.uid(), coalesce(nm,'Meg'), '#0d9488', 'adult');
  insert into public.lists (household_id, name, type) values (hh, 'Handleliste', 'shopping');
  update public.profiles set active_household_id = hh where id = auth.uid();
  return hh;
end; $function$;

create or replace function public.create_invite(p_ttl_hours integer default 168)
 returns text
 language plpgsql
 security definer
as $function$
declare hh uuid; t text;
begin
  hh := public.current_household_id();
  if hh is null then raise exception 'Ingen aktiv husholdning'; end if;
  loop
    t := public.gen_invite_token();
    exit when not exists (select 1 from public.household_invites where code = t);
  end loop;
  insert into public.household_invites (household_id, code, created_by, expires_at)
    values (hh, t, auth.uid(), now() + make_interval(hours => p_ttl_hours));
  return t;
end; $function$;

create or replace function public.create_shopping_list(p_name text, p_icon text default '🛒'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_hid uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT household_id INTO v_hid FROM public.household_members WHERE user_id = v_uid AND active_household = true;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'No active household'; END IF;
  INSERT INTO public.shopping_lists (household_id, name, icon, created_by) VALUES (v_hid, p_name, p_icon, v_uid) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

create or replace function public.create_todo_list(p_name text, p_icon text default '✅'::text, p_color text default '#6366f1'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_hid uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT household_id INTO v_hid FROM public.household_members WHERE user_id = v_uid AND active_household = true;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'No active household'; END IF;
  INSERT INTO public.todo_lists (household_id, name, icon, color, created_by) VALUES (v_hid, p_name, p_icon, p_color, v_uid) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

create or replace function public.current_household_id()
 returns uuid
 language sql
 stable
 security definer
as $function$
  select active_household_id from public.profiles where id = auth.uid();
$function$;

create or replace function public.gen_invite_code()
 returns text
 language sql
as $function$ select upper(substr(md5(random()::text), 1, 6)); $function$;

create or replace function public.gen_invite_token()
 returns text
 language sql
as $function$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32)::int)+1, 1), ''
  ) from generate_series(1, 8);
$function$;

create or replace function public.generate_meal_shopping_list(p_week_start date)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_hid uuid; v_list_id uuid; v_ing record; v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT household_id INTO v_hid FROM public.household_members WHERE user_id = v_uid AND active_household = true;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'No active household'; END IF;

  INSERT INTO public.shopping_lists (household_id, name, icon, created_by)
  VALUES (v_hid, 'Middager ' || to_char(p_week_start, 'DD.MM') || '–' || to_char(p_week_start + 6, 'DD.MM'), '🍽️', v_uid)
  RETURNING id INTO v_list_id;

  FOR v_ing IN
    SELECT DISTINCT
      trim(coalesce(ing->>'amount','') || ' ' || coalesce(ing->>'unit','') || ' ' || coalesce(ing->>'name','')) AS item_name
    FROM public.meals m
    JOIN public.recipes r ON r.id = m.recipe_id
    CROSS JOIN jsonb_array_elements(r.ingredients) AS ing
    WHERE m.household_id = v_hid
      AND m.date >= p_week_start
      AND m.date < p_week_start + INTERVAL '7 days'
      AND jsonb_array_length(r.ingredients) > 0
      AND ing->>'name' IS NOT NULL
  LOOP
    INSERT INTO public.shopping_items (household_id, shopping_list_id, name)
    VALUES (v_hid, v_list_id, v_ing.item_name);
    v_count := v_count + 1;
  END LOOP;

  -- If no recipe ingredients, add meal titles as items
  IF v_count = 0 THEN
    FOR v_ing IN
      SELECT coalesce(m.title, r.title) AS item_name
      FROM public.meals m
      LEFT JOIN public.recipes r ON r.id = m.recipe_id
      WHERE m.household_id = v_hid
        AND m.date >= p_week_start AND m.date < p_week_start + INTERVAL '7 days'
        AND coalesce(m.title, r.title) IS NOT NULL
    LOOP
      INSERT INTO public.shopping_items (household_id, shopping_list_id, name)
      VALUES (v_hid, v_list_id, '🍽️ ' || v_ing.item_name);
    END LOOP;
  END IF;

  RETURN v_list_id;
END;
$function$;

create or replace function public.generate_meal_shopping_list_heim(p_week_start date)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_hid  uuid;
  v_list uuid;
  v_ing  record;
  v_cnt  int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT active_household_id INTO v_hid FROM public.profiles WHERE id = v_uid;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'No active household'; END IF;

  INSERT INTO public.lists (household_id, name, type)
  VALUES (v_hid,
          'Middager ' || to_char(p_week_start,'DD.MM') || '–' || to_char(p_week_start+6,'DD.MM'),
          'shopping')
  RETURNING id INTO v_list;

  FOR v_ing IN
    SELECT DISTINCT
      trim(
        coalesce(nullif(ing->>'amount',''),'') || ' ' ||
        coalesce(nullif(ing->>'unit',''),'')   || ' ' ||
        coalesce(ing->>'name','')
      ) AS item_name
    FROM public.meals m
    JOIN public.recipes r ON r.id = m.recipe_id
    CROSS JOIN jsonb_array_elements(r.ingredients) AS ing
    WHERE m.household_id = v_hid
      AND m.date >= p_week_start
      AND m.date < p_week_start + INTERVAL '7 days'
      AND jsonb_array_length(r.ingredients) > 0
      AND ing->>'name' IS NOT NULL AND ing->>'name' <> ''
  LOOP
    INSERT INTO public.list_items (list_id, text) VALUES (v_list, v_ing.item_name);
    v_cnt := v_cnt + 1;
  END LOOP;

  -- Fallback: add meal titles if no ingredients found
  IF v_cnt = 0 THEN
    FOR v_ing IN
      SELECT coalesce(m.title, r.title) AS item_name
      FROM public.meals m
      LEFT JOIN public.recipes r ON r.id = m.recipe_id
      WHERE m.household_id = v_hid
        AND m.date >= p_week_start
        AND m.date < p_week_start + INTERVAL '7 days'
        AND coalesce(m.title, r.title) IS NOT NULL
    LOOP
      INSERT INTO public.list_items (list_id, text) VALUES (v_list, '🍽️ ' || v_ing.item_name);
    END LOOP;
  END IF;

  RETURN v_list;
END;
$function$;

create or replace function public.get_feed_events(p_token text)
 returns table(event_id uuid, title text, location text, notes text, start_at timestamp with time zone, end_at timestamp with time zone, all_day boolean, recurrence text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid
  FROM public.calendar_feeds
  WHERE token = p_token AND revoked_at IS NULL;
  IF v_hid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT e.id, e.title, e.location, e.notes, e.start_at, e.end_at, e.all_day, e.recurrence
    FROM public.events e WHERE e.household_id = v_hid ORDER BY e.start_at;
END;
$function$;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$function$;

create or replace function public.is_member(p_household_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id
      AND user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.members
    WHERE household_id = p_household_id
      AND auth_user_id = (SELECT auth.uid())
  );
$function$;

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
    insert into public.members (household_id, auth_user_id, name, color, role)
      values (inv.household_id, auth.uid(), coalesce(nm,'Meg'), '#f59e0b', 'adult');
  end if;
  update public.household_invites set used_at = now() where id = inv.id;
  update public.profiles set active_household_id = inv.household_id where id = auth.uid();
  return inv.household_id;
end; $function$;

create or replace function public.leave_household(p_hid uuid)
 returns uuid
 language plpgsql
 security definer
as $function$
declare nexth uuid;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  delete from public.members where household_id = p_hid and auth_user_id = auth.uid();
  select household_id into nexth from public.members
    where auth_user_id = auth.uid() order by created_at limit 1;
  update public.profiles set active_household_id = nexth where id = auth.uid();
  return nexth;
end; $function$;

create or replace function public.my_household_ids()
 returns setof uuid
 language sql
 stable
 security definer
as $function$
  select household_id from public.members where auth_user_id = auth.uid();
$function$;

create or replace function public.set_active_household(p_hid uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_hid and user_id = v_uid
  ) then raise exception 'Not a member of this household'; end if;

  update public.household_members
  set active_household = (household_id = p_hid)
  where user_id = v_uid;
end;
$function$;

-- ---------- Policyer for nye tabeller ----------

drop policy if exists "Members can view members list" on household_members;
create policy "Members can view members list" on household_members
  for select using (is_member(household_id) or auth.uid() = user_id);

drop policy if exists "Members can create invites" on invites;
create policy "Members can create invites" on invites
  for insert with check (is_member(household_id));
drop policy if exists "Members can view invites" on invites;
create policy "Members can view invites" on invites
  for select using (is_member(household_id));

drop policy if exists "Members can add children" on children;
create policy "Members can add children" on children
  for insert with check (is_member(household_id));
drop policy if exists "Members can delete children" on children;
create policy "Members can delete children" on children
  for delete using (is_member(household_id));
drop policy if exists "Members can view children" on children;
create policy "Members can view children" on children
  for select using (is_member(household_id));

drop policy if exists "Members delete events" on events;
create policy "Members delete events" on events
  for delete using (is_member(household_id));
drop policy if exists "Members insert events" on events;
create policy "Members insert events" on events
  for insert with check (is_member(household_id));
drop policy if exists "Members update events" on events;
create policy "Members update events" on events
  for update using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "Members view events" on events;
create policy "Members view events" on events
  for select using (is_member(household_id));

drop policy if exists "Members manage event_members" on event_members;
create policy "Members manage event_members" on event_members
  for all
  using (exists (select 1 from events e where e.id = event_members.event_id and is_member(e.household_id)))
  with check (exists (select 1 from events e where e.id = event_members.event_id and is_member(e.household_id)));

drop policy if exists "Members manage event_children" on event_children;
create policy "Members manage event_children" on event_children
  for all
  using (exists (select 1 from events e where e.id = event_children.event_id and is_member(e.household_id)))
  with check (exists (select 1 from events e where e.id = event_children.event_id and is_member(e.household_id)));

drop policy if exists "Members manage calendar feeds" on calendar_feeds;
create policy "Members manage calendar feeds" on calendar_feeds
  for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists "Members delete todo lists" on todo_lists;
create policy "Members delete todo lists" on todo_lists
  for delete using (is_member(household_id));
drop policy if exists "Members insert todo lists" on todo_lists;
create policy "Members insert todo lists" on todo_lists
  for insert with check (is_member(household_id));
drop policy if exists "Members update todo lists" on todo_lists;
create policy "Members update todo lists" on todo_lists
  for update using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "Members view todo lists" on todo_lists;
create policy "Members view todo lists" on todo_lists
  for select using (is_member(household_id));

drop policy if exists "Members delete todos" on todos;
create policy "Members delete todos" on todos
  for delete using (is_member(household_id));
drop policy if exists "Members insert todos" on todos;
create policy "Members insert todos" on todos
  for insert with check (is_member(household_id));
drop policy if exists "Members update todos" on todos;
create policy "Members update todos" on todos
  for update using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "Members view todos" on todos;
create policy "Members view todos" on todos
  for select using (is_member(household_id));

drop policy if exists "Members delete shopping lists" on shopping_lists;
create policy "Members delete shopping lists" on shopping_lists
  for delete using (is_member(household_id));
drop policy if exists "Members insert shopping lists" on shopping_lists;
create policy "Members insert shopping lists" on shopping_lists
  for insert with check (is_member(household_id));
drop policy if exists "Members update shopping lists" on shopping_lists;
create policy "Members update shopping lists" on shopping_lists
  for update using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "Members view shopping lists" on shopping_lists;
create policy "Members view shopping lists" on shopping_lists
  for select using (is_member(household_id));

drop policy if exists "Members can add shopping items" on shopping_items;
create policy "Members can add shopping items" on shopping_items
  for insert with check (is_member(household_id));
drop policy if exists "Members can delete shopping items" on shopping_items;
create policy "Members can delete shopping items" on shopping_items
  for delete using (is_member(household_id));
drop policy if exists "Members can update shopping items" on shopping_items;
create policy "Members can update shopping items" on shopping_items
  for update using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "Members can view shopping items" on shopping_items;
create policy "Members can view shopping items" on shopping_items
  for select using (is_member(household_id));

drop policy if exists "Members manage recipes" on recipes;
create policy "Members manage recipes" on recipes
  for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists "Members manage meals" on meals;
create policy "Members manage meals" on meals
  for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists "Members manage allowance_accounts" on allowance_accounts;
create policy "Members manage allowance_accounts" on allowance_accounts
  for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists "Members manage allowance_transactions" on allowance_transactions;
create policy "Members manage allowance_transactions" on allowance_transactions
  for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists "Members manage savings_goals" on savings_goals;
create policy "Members manage savings_goals" on savings_goals
  for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists "Members create notifications" on notifications;
create policy "Members create notifications" on notifications
  for insert with check (is_member(household_id));
drop policy if exists "Users mark own as read" on notifications;
create policy "Users mark own as read" on notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
drop policy if exists "Users see own notifications" on notifications;
create policy "Users see own notifications" on notifications
  for select using (auth.uid() = recipient_id);

-- ---------- Oppdaterte policyer på eksisterende tabeller (driftet fra 0001–0003) ----------

drop policy if exists "egen husholdning - households" on households;
drop policy if exists "mine husholdninger - households" on households;
drop policy if exists "Members can update household" on households;
drop policy if exists "Members can view household" on households;
create policy "Members can update household" on households
  for update using (is_member(id)) with check (is_member(id));
create policy "Members can view household" on households
  for select using (is_member(id));

drop policy if exists "egen profil" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- ---------- Sanntid ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='allowance_accounts') then
    alter publication supabase_realtime add table allowance_accounts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='allowance_transactions') then
    alter publication supabase_realtime add table allowance_transactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_children') then
    alter publication supabase_realtime add table event_children;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_members') then
    alter publication supabase_realtime add table event_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='meals') then
    alter publication supabase_realtime add table meals;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
