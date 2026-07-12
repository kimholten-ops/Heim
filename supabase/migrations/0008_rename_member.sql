-- Lar et husholdningsmedlem endre navnet på et hvilket som helst medlem
-- (seg selv eller andre, inkl. barn) i samme husholdning.
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

  if not exists (
    select 1 from public.members
    where household_id = v_hid and auth_user_id = (select auth.uid())
  ) then
    raise exception 'Ikke medlem av husholdningen';
  end if;

  update public.members set name = v_name where id = p_member_id;
end;
$function$;
