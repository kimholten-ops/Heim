-- Enkel per-bruker rate-limiting for kostnads-/nettverkskall (recipe-import,
-- calendar-imports/sync, varer). Tabellen skrives/leses KUN via
-- check_rate_limit() (security definer) — ingen policies gir klienten
-- direkte tilgang, kun RLS-aktivering for hygiene.
create table if not exists api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_limits_user_endpoint_idx
  on api_rate_limits(user_id, endpoint, created_at);

alter table api_rate_limits enable row level security;

create or replace function public.check_rate_limit(p_endpoint text, p_max int, p_window_minutes int)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_count int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;

  delete from public.api_rate_limits
    where user_id = v_uid and endpoint = p_endpoint
      and created_at < now() - (p_window_minutes || ' minutes')::interval;

  select count(*) into v_count from public.api_rate_limits
    where user_id = v_uid and endpoint = p_endpoint
      and created_at > now() - (p_window_minutes || ' minutes')::interval;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.api_rate_limits (user_id, endpoint) values (v_uid, p_endpoint);
  return true;
end;
$function$;
