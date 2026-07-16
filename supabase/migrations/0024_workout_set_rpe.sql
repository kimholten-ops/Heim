-- RPE (Rate of Perceived Exertion, 1-10) per sett — valgfritt, brukes til å
-- gjøre progressiv-overbelastning-forslag (treningscoachen, ukesprogrammet)
-- mer presise enn vekt/reps alene.
alter table workout_sets add column if not exists rpe integer;

alter table workout_sets drop constraint if exists workout_sets_rpe_check;
alter table workout_sets add constraint workout_sets_rpe_check
  check (rpe is null or (rpe >= 1 and rpe <= 10));
