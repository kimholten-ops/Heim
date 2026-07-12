-- IP-basert rate limiting, i tillegg til per-bruker (0010). Formålet er å
-- hindre at noen omgår per-bruker-grensen ved å opprette flere kontoer.
--
-- Denne tabellen har BEVISST ingen RLS-policies (kun RLS aktivert = default
-- deny). Den skal KUN nås via service_role-nøkkelen fra server-kode
-- (src/lib/supabase/service.ts) — aldri via en klient-kallbar RPC, siden en
-- IP-streng oppgitt av klienten selv ikke kan stoles på (hvem som helst kunne
-- da forsøke å tømme kvoten til en annen IP-adresse). Tabellen inneholder
-- ingen husholdningsdata, kun IP-strenger, endepunktnavn og tidsstempler.
create table if not exists ip_rate_limits (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists ip_rate_limits_idx on ip_rate_limits(ip_address, endpoint, created_at);

alter table ip_rate_limits enable row level security;
