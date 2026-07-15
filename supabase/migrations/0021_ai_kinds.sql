-- Utvider ai_usage.kind til å dekke AI-bruk utenfor helse-veilederen
-- (Smart Add-tolkning, oppskriftsimport-fallback, ukesmeny-forslag) —
-- alle deler samme rate-limit-pott (ai_check_rate_limit fra 0020 teller
-- på tvers av alle kind-verdier allerede, ingen endring nødvendig der).
alter table ai_usage drop constraint if exists ai_usage_kind_check;
alter table ai_usage add constraint ai_usage_kind_check
  check (kind in ('chat','ukesprogram','gjennomgang','maltid','smartadd','oppskrift','ukesmeny'));
