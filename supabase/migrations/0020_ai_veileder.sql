-- AI-veileder (kosthold/trening) — privat per medlem, samme mønster som
-- workout_sessions/weight_entries/food_log_entries (my_member_ids() fra 0017).
--
-- ai_usage logger token-forbruk fra HVERT kall (chat/ukesprogram/gjennomgang/
-- maltid) — dette er både grunnlaget for kostnadsvisningen i UI-et og for
-- rate-limitene under, så vi unngår å telle det samme to steder.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('chat','ukesprogram','gjennomgang','maltid')),
  input_tokens int not null,
  output_tokens int not null,
  cache_read_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_member_created_idx on ai_usage (member_id, created_at desc);

alter table ai_usage enable row level security;

drop policy if exists "Eier egen ai-bruk" on ai_usage;
create policy "Eier egen ai-bruk" on ai_usage
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));
-- Ingen realtime på denne tabellen (kun lest via periodisk forbruksvisning,
-- ikke live-oppdatert UI).

-- Ukesgjennomgangen caches — én per medlem per uke (week_start = mandag i
-- inneværende uke), slik at gjentatte visninger ikke koster et nytt API-kall.
create table if not exists ai_weekly_reviews (
  member_id uuid not null references members(id) on delete cascade,
  week_start date not null,
  text text not null,
  created_at timestamptz not null default now(),
  primary key (member_id, week_start)
);

alter table ai_weekly_reviews enable row level security;

drop policy if exists "Eier egen ukesgjennomgang" on ai_weekly_reviews;
create policy "Eier egen ukesgjennomgang" on ai_weekly_reviews
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));

-- ---------- Rate-limit-sjekk (håndheves FØR hvert API-kall) ----------
-- Egen security-definer-funksjon (samme mønster som check_rate_limit i 0010)
-- fordi grensene her leses direkte fra ai_usage — inkludert husholdnings-
-- summen på tvers av medlemmer, som vanlig RLS (privat per medlem) ikke lar
-- en klient telle selv. Funksjonen avslører aldri rader, kun et ja/nei-svar,
-- og verifiserer selv at p_member_id faktisk eies av innlogget bruker
-- (auth.uid()) — den stoler ikke på at kalleren har rett til medlemmet.
create or replace function public.ai_check_rate_limit(
  p_member_id uuid,
  p_daily_max int default 25,
  p_monthly_max int default 600
)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_household_id uuid;
  v_daily_count int;
  v_monthly_count int;
begin
  if not exists (
    select 1 from public.members
    where id = p_member_id and auth_user_id = (select auth.uid())
  ) then
    return false;
  end if;

  select household_id into v_household_id from public.members where id = p_member_id;

  select count(*) into v_daily_count
    from public.ai_usage
    where member_id = p_member_id and created_at >= date_trunc('day', now());
  if v_daily_count >= p_daily_max then
    return false;
  end if;

  select count(*) into v_monthly_count
    from public.ai_usage au
    join public.members m on m.id = au.member_id
    where m.household_id = v_household_id
      and au.created_at >= date_trunc('month', now());
  if v_monthly_count >= p_monthly_max then
    return false;
  end if;

  return true;
end;
$function$;
