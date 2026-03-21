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

alter table public.athletes disable row level security;
alter table public.interventions disable row level security;
