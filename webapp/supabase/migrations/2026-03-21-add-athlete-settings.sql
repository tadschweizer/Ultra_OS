create table if not exists public.athlete_settings (
  athlete_id uuid primary key references public.athletes (id) on delete cascade,
  baseline_sleep_altitude_ft integer,
  baseline_training_altitude_ft integer,
  resting_hr integer,
  max_hr integer,
  hr_zone_1_min integer,
  hr_zone_1_max integer,
  hr_zone_2_min integer,
  hr_zone_2_max integer,
  hr_zone_3_min integer,
  hr_zone_3_max integer,
  hr_zone_4_min integer,
  hr_zone_4_max integer,
  hr_zone_5_min integer,
  hr_zone_5_max integer,
  notes text,
  updated_at timestamptz default now()
);

alter table public.athlete_settings disable row level security;

grant select, insert, update, delete on table public.athlete_settings to anon, authenticated;
