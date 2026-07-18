-- Ny AI-kind for dagsplan-forslaget (måltidsplan for hele dagen: frokost,
-- lunsj, middag hvis ikke allerede planlagt, og kvelds — se buildDagsplanContext).
alter table ai_usage drop constraint if exists ai_usage_kind_check;
alter table ai_usage add constraint ai_usage_kind_check
  check (kind in ('chat','ukesprogram','gjennomgang','maltid','smartadd','oppskrift','ukesmeny','trening','dagsplan'));
