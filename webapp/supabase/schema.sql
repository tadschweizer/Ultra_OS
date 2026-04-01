create extension if not exists "pgcrypto";

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  supabase_user_id uuid unique,
  strava_id text unique,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'research', 'individual', 'coach')),
  subscription_activated_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  stripe_subscription_status text,
  onboarding_complete boolean not null default false,
  primary_sports text[] not null default '{}'::text[],
  years_racing_band text,
  weekly_training_hours_band text,
  home_elevation_ft integer
);

create index if not exists idx_athletes_supabase_user_id
  on public.athletes (supabase_user_id);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  activity_id text,
  date date,
  intervention_type text,
  details text,
  dose_duration text,
  timing text,
  protocol_payload jsonb not null default '{}'::jsonb,
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
  race_type text,
  distance_miles numeric,
  elevation_gain_ft integer,
  location text,
  surface text,
  notes text,
  inserted_at timestamptz default now()
);

alter table public.athletes
add column if not exists target_race_id uuid references public.races (id) on delete set null;

create table if not exists public.race_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  city text,
  state text,
  country text not null default 'USA',
  distance_miles numeric,
  sport_type text not null
);

create index if not exists race_catalog_name_idx
  on public.race_catalog using gin (to_tsvector('simple', name));

create index if not exists race_catalog_sport_type_idx
  on public.race_catalog (sport_type);

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
  sweat_sodium_concentration_mg_l integer,
  sodium_target_mg_per_hr integer,
  fluid_target_ml_per_hr integer,
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

create table if not exists public.athlete_supplements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  supplement_name text,
  amount numeric,
  unit text,
  frequency_per_day integer default 1,
  inserted_at timestamptz default now()
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

create table if not exists public.coach_profiles (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid unique references public.athletes (id) on delete cascade,
  display_name text not null,
  coach_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_athlete_links (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  coach_id uuid not null references public.coach_profiles (id) on delete cascade,
  role text not null check (role in ('primary', 'secondary')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create unique index if not exists coach_athlete_links_unique_active_role_idx
  on public.coach_athlete_links (athlete_id, role)
  where status = 'active';

create table if not exists public.coach_protocol_assignments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  coach_id uuid not null references public.coach_profiles (id) on delete cascade,
  target_race_id uuid references public.races (id) on delete set null,
  intervention_type text not null,
  start_date date not null,
  target_completion_date date not null,
  frequency_type text not null check (frequency_type in ('daily', 'every_other_day', 'weekly', 'custom')),
  frequency_details jsonb not null default '{}'::jsonb,
  planned_sessions integer not null default 0 check (planned_sessions >= 0),
  note text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_protocol_assignments_athlete_status_idx
  on public.coach_protocol_assignments (athlete_id, status, target_completion_date desc);

create index if not exists research_library_entries_published_idx
  on public.research_library_entries (published);

create index if not exists research_library_entries_topic_tags_idx
  on public.research_library_entries using gin (topic_tags);

alter table public.athletes disable row level security;
alter table public.interventions disable row level security;
alter table public.athlete_settings disable row level security;
alter table public.athlete_supplements disable row level security;
alter table public.races disable row level security;
alter table public.coach_profiles disable row level security;
alter table public.coach_athlete_links disable row level security;
alter table public.coach_protocol_assignments disable row level security;
alter table public.race_catalog disable row level security;
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
grant select, insert, update, delete on table public.athlete_supplements to anon, authenticated;
grant select, insert, update, delete on table public.races to anon, authenticated;
grant select, insert, update, delete on table public.coach_profiles to anon, authenticated;
grant select, insert, update, delete on table public.coach_athlete_links to anon, authenticated;
grant select, insert, update, delete on table public.coach_protocol_assignments to anon, authenticated;
grant select, insert, update, delete on table public.race_catalog to anon, authenticated;
grant select on table public.research_library_entries to anon, authenticated;
