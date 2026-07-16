-- Strava-integrasjon: per-medlem OAuth-kobling + sporing av hvilke økter som
-- allerede er delt (unngår duplikat-eksport, og lar UI-et vise "Se på
-- Strava" i stedet for eksporter-knappen når det allerede er gjort).
create table if not exists strava_connections (
  member_id uuid primary key references members(id) on delete cascade,
  athlete_id bigint not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now()
);

alter table strava_connections enable row level security;

drop policy if exists "Eier egen Strava-kobling" on strava_connections;
create policy "Eier egen Strava-kobling" on strava_connections
  for all using (member_id in (select my_member_ids()))
  with check (member_id in (select my_member_ids()));

alter table workout_sessions add column if not exists strava_activity_id bigint;
