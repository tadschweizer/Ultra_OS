create extension if not exists "pgcrypto";

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  strava_id text unique,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  activity_id text,
  date date,
  intervention_type text,
  details text,
  dose_duration text,
  timing text,
  gi_response integer,
  physical_response integer,
  subjective_feel integer,
  training_phase text,
  target_race text,
  target_race_date date,
  notes text,
  inserted_at timestamptz default now()
);

create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  name text not null,
  event_date date,
  distance_miles numeric,
  elevation_gain_ft integer,
  location text,
  surface text,
  notes text,
  inserted_at timestamptz default now()
);

alter table public.interventions
add column if not exists race_id uuid references public.races (id) on delete set null;

create table if not exists public.athlete_settings (
  athlete_id uuid primary key references public.athletes (id) on delete cascade,
  baseline_sleep_altitude_ft integer,
  baseline_training_altitude_ft integer,
  resting_hr integer,
  max_hr integer,
  body_weight_lb integer,
  normal_long_run_carb_g_per_hr integer,
  sweat_rate_l_per_hr numeric,
  sodium_target_mg_per_hr integer,
  typical_sleep_hours numeric,
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

alter table public.athletes disable row level security;
alter table public.interventions disable row level security;
alter table public.athlete_settings disable row level security;
alter table public.races disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.athletes to anon, authenticated;
grant select, insert, update, delete on table public.interventions to anon, authenticated;
grant select, insert, update, delete on table public.athlete_settings to anon, authenticated;
grant select, insert, update, delete on table public.races to anon, authenticated;
