-- =====================================================================
-- 0003 – sikrere invitasjoner (token m/ utløp + engangsbruk),
--        samt forlat / opprett husholdning og pen håndtering av "ingen
--        aktiv husholdning". Bygger på 0001 + 0002.
-- =====================================================================

-- Lengre, ikke-gjettbar token (32-tegns alfabet uten forvekslbare tegn)
create or replace function gen_invite_token()
returns text language sql as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32)::int)+1, 1), ''
  ) from generate_series(1, 8);
$$;

-- Invitasjoner: én rad pr. utstedt invitasjon, med utløp og engangsbruk.
create table if not exists household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  created_at timestamptz default now()
);

alter table household_invites enable row level security;
drop policy if exists "mine invitasjoner" on household_invites;
create policy "mine invitasjoner" on household_invites
  for all using (household_id in (select my_household_ids()));

-- Lag en invitasjon for aktiv husholdning, returnerer koden.
create or replace function create_invite(p_ttl_hours int default 168)
returns text language plpgsql security definer as $$
declare hh uuid; t text;
begin
  hh := current_household_id();
  if hh is null then raise exception 'Ingen aktiv husholdning'; end if;
  if not exists (select 1 from members where household_id = hh and auth_user_id = auth.uid()) then
    raise exception 'Ikke medlem';
  end if;
  loop
    t := gen_invite_token();
    exit when not exists (select 1 from household_invites where code = t);
  end loop;
  insert into household_invites (household_id, code, created_by, expires_at)
    values (hh, t, auth.uid(), now() + make_interval(hours => p_ttl_hours));
  return t;
end; $$;

-- Bli med via kode: validerer eksistens, utløp og engangsbruk.
create or replace function join_household(p_code text)
returns uuid language plpgsql security definer as $$
declare inv household_invites%rowtype; nm text;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  select * into inv from household_invites where code = upper(trim(p_code));
  if inv.id is null then raise exception 'Ugyldig invitasjonskode'; end if;
  if inv.used_at is not null then raise exception 'Koden er allerede brukt'; end if;
  if inv.expires_at < now() then raise exception 'Koden er utløpt'; end if;

  select coalesce(display_name,'Meg') into nm from profiles where id = auth.uid();
  if not exists (select 1 from members where household_id = inv.household_id and auth_user_id = auth.uid()) then
    insert into members (household_id, auth_user_id, name, color, role)
      values (inv.household_id, auth.uid(), coalesce(nm,'Meg'), '#f59e0b', 'adult');
  end if;

  update household_invites set used_at = now() where id = inv.id;
  update profiles set active_household_id = inv.household_id where id = auth.uid();
  return inv.household_id;
end; $$;

-- Forlat en husholdning. Setter aktiv til en annen jeg er med i (ev. NULL).
create or replace function leave_household(p_hid uuid)
returns uuid language plpgsql security definer as $$
declare nexth uuid;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  delete from members where household_id = p_hid and auth_user_id = auth.uid();
  select household_id into nexth from members
    where auth_user_id = auth.uid() order by created_at limit 1;
  update profiles set active_household_id = nexth where id = auth.uid();
  return nexth;
end; $$;

-- Opprett en ny husholdning (brukes ved tom tilstand / "ny familie").
create or replace function create_household(p_name text)
returns uuid language plpgsql security definer as $$
declare hh uuid; nm text;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  select coalesce(display_name,'Meg') into nm from profiles where id = auth.uid();
  insert into households (name) values (coalesce(nullif(p_name,''),'Min husholdning')) returning id into hh;
  insert into members (household_id, auth_user_id, name, color, role)
    values (hh, auth.uid(), coalesce(nm,'Meg'), '#0d9488', 'adult');
  insert into lists (household_id, name, type) values (hh, 'Handleliste', 'shopping');
  update profiles set active_household_id = hh where id = auth.uid();
  return hh;
end; $$;
