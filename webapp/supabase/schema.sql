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

create table if not exists public.research_library_entries (
  id uuid primary key default gen_random_uuid(),
  pubmed_id text unique,
  title text not null,
  authors text,
  journal text,
  publication_year integer,
  publication_date date,
  pubmed_url text not null,
  topic_tags text[] not null default '{}',
  plain_english_summary text,
  practical_takeaway text,
  commentary text,
  ultra_score integer not null default 0,
  gravel_score integer not null default 0,
  triathlon_score integer not null default 0,
  published boolean not null default false,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint research_library_entries_ultra_score_check check (ultra_score between 0 and 5),
  constraint research_library_entries_gravel_score_check check (gravel_score between 0 and 5),
  constraint research_library_entries_triathlon_score_check check (triathlon_score between 0 and 5)
);

create index if not exists research_library_entries_published_idx
  on public.research_library_entries (published);

create index if not exists research_library_entries_topic_tags_idx
  on public.research_library_entries using gin (topic_tags);

alter table public.athletes disable row level security;
alter table public.interventions disable row level security;
alter table public.athlete_settings disable row level security;
alter table public.races disable row level security;
alter table public.research_library_entries enable row level security;

drop policy if exists "Published research entries are public readable" on public.research_library_entries;
create policy "Published research entries are public readable"
  on public.research_library_entries
  for select
  to anon, authenticated
  using (published = true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.athletes to anon, authenticated;
grant select, insert, update, delete on table public.interventions to anon, authenticated;
grant select, insert, update, delete on table public.athlete_settings to anon, authenticated;
grant select, insert, update, delete on table public.races to anon, authenticated;
grant select on table public.research_library_entries to anon, authenticated;
