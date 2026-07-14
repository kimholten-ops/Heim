-- Retter to funn fra sikkerhetsgjennomgang:
--
-- 1) household_invites beholdt sin opprinnelige "mine invitasjoner"-policy fra
--    0003 (for all using (household_id in my_household_ids())) etter at 0015
--    la til gjestetilgang. Siden en "for all"-policy uten egen WITH CHECK
--    bruker USING-uttrykket som sjekk også for INSERT, og my_household_ids()
--    ikke skiller på household_role, kunne en gjest omgå is_full_member()-
--    sjekken i create_invite() ved å sette inn en invitasjonsrad direkte via
--    klienten — og dermed selv utstede en 'medlem'-invitasjon, stikk i strid
--    med hele poenget med gjesterollen.
--
-- 2) notifications sin INSERT-policy sjekket kun is_member(household_id), uten
--    å kreve at member_id faktisk tilhører den husstanden. Et hvilket som helst
--    medlem (inkl. gjester) kunne dermed sette inn et varsel adressert til et
--    hvilket som helst annet medlem i husstanden.

-- ---------- household_invites: rolle-bevisste policyer ----------
drop policy if exists "mine invitasjoner" on household_invites;

drop policy if exists "Medlemmer ser invitasjoner" on household_invites;
create policy "Medlemmer ser invitasjoner" on household_invites
  for select using (household_id in (select my_household_ids()));

drop policy if exists "Fullverdige medlemmer oppretter invitasjoner" on household_invites;
create policy "Fullverdige medlemmer oppretter invitasjoner" on household_invites
  for insert with check (household_id in (select my_full_access_household_ids()));

drop policy if exists "Fullverdige medlemmer oppdaterer invitasjoner" on household_invites;
create policy "Fullverdige medlemmer oppdaterer invitasjoner" on household_invites
  for update using (household_id in (select my_full_access_household_ids()))
  with check (household_id in (select my_full_access_household_ids()));

drop policy if exists "Fullverdige medlemmer sletter invitasjoner" on household_invites;
create policy "Fullverdige medlemmer sletter invitasjoner" on household_invites
  for delete using (household_id in (select my_full_access_household_ids()));

-- ---------- notifications: member_id må tilhøre household_id ----------
drop policy if exists "Household members insert notifications" on notifications;
create policy "Household members insert notifications" on notifications
  for insert with check (
    is_member(household_id)
    and exists (
      select 1 from members
      where id = notifications.member_id and household_id = notifications.household_id
    )
  );
