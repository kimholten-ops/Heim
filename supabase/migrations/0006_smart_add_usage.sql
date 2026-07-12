-- =====================================================================
-- 0006 – enkel per-bruker daglig bruksgrense for Smart Add (AI-basert
--        hendelse-ekstraksjon). Serverless-funksjoner deler ikke minne
--        mellom kall, så telling må ligge i databasen, ikke in-memory.
-- =====================================================================

create table if not exists smart_add_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table smart_add_usage enable row level security;

drop policy if exists "Users view own smart_add_usage" on smart_add_usage;
create policy "Users view own smart_add_usage" on smart_add_usage
  for select using (auth.uid() = user_id);

-- Atomisk increment-og-les. SECURITY DEFINER slik at klienten ikke
-- trenger egne insert/update-policyer på tabellen (kun denne funksjonen
-- kan skrive), og kallet er trygt mot samtidige forespørsler.
create or replace function public.increment_smart_add_usage()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  insert into public.smart_add_usage (user_id, day, count)
  values (v_uid, current_date, 1)
  on conflict (user_id, day) do update
    set count = public.smart_add_usage.count + 1
  returning count into v_count;

  return v_count;
end;
$function$;
