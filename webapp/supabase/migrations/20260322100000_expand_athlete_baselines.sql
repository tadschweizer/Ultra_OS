alter table public.athlete_settings
add column if not exists sweat_sodium_concentration_mg_l integer,
add column if not exists fluid_target_ml_per_hr integer;
alter table public.athlete_supplements
add column if not exists amount numeric,
add column if not exists unit text,
add column if not exists frequency_per_day integer default 1;
update public.athlete_supplements
set
  amount = null,
  unit = coalesce(unit, 'mg'),
  frequency_per_day = coalesce(frequency_per_day, 1)
where unit is null or frequency_per_day is null;
