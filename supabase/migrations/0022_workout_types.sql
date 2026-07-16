-- Økt-type (styrke/cardio/yoga/mobilitet/annet) + felter for ikke-styrke-økter
-- (distanse — varighet regnes fortsatt fra started_at/finished_at, som for
-- styrke), samt en cachet AI-coach-vurdering per økt.
alter table workout_sessions
  add column if not exists type text not null default 'styrke',
  add column if not exists distance_km numeric(6,2),
  add column if not exists ai_review text;

alter table workout_sessions drop constraint if exists workout_sessions_type_check;
alter table workout_sessions add constraint workout_sessions_type_check
  check (type in ('styrke','cardio','yoga','mobilitet','annet'));

-- Ny AI-kind for treningscoachen (deler samme AI-lib/budsjett som alt annet).
alter table ai_usage drop constraint if exists ai_usage_kind_check;
alter table ai_usage add constraint ai_usage_kind_check
  check (kind in ('chat','ukesprogram','gjennomgang','maltid','smartadd','oppskrift','ukesmeny','trening'));
