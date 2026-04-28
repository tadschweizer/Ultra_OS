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
  strava_last_sync timestamptz,
  strava_sync_status text not null default 'idle',
  strava_sync_error text,
  strava_sync_started_at timestamptz,
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

create table if not exists public.strava_activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  strava_activity_id text not null,
  name text,
  sport_type text,
  activity_type text,
  start_date timestamptz,
  timezone text,
  distance numeric,
  moving_time integer,
  elapsed_time integer,
  total_elevation_gain numeric,
  average_speed numeric,
  max_speed numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  kilojoules numeric,
  trainer boolean not null default false,
  commute boolean not null default false,
  manual boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, strava_activity_id)
);

create index if not exists strava_activities_athlete_start_date_idx
  on public.strava_activities (athlete_id, start_date desc);

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'trainingpeaks')),
  provider_athlete_id text,
  status text not null default 'connected' check (status in ('connected', 'paused', 'error', 'revoked')),
  scopes text[] not null default '{}'::text[],
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_webhook_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, provider),
  unique (provider, provider_athlete_id)
);

create index if not exists provider_connections_provider_status_idx
  on public.provider_connections (provider, status);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  provider_connection_id uuid references public.provider_connections (id) on delete set null,
  provider text not null check (provider in ('strava', 'garmin', 'trainingpeaks')),
  event_kind text not null,
  event_status text not null default 'received' check (event_status in ('received', 'processed', 'ignored', 'error')),
  external_event_id text not null,
  external_activity_id text,
  provider_athlete_id text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_notes text,
  payload jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index if not exists activity_events_athlete_received_idx
  on public.activity_events (athlete_id, received_at desc);

create index if not exists activity_events_provider_status_idx
  on public.activity_events (provider, event_status, received_at desc);

create table if not exists public.activity_follow_up_prompts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  activity_event_id uuid references public.activity_events (id) on delete set null,
  provider text not null check (provider in ('strava', 'garmin', 'trainingpeaks')),
  provider_activity_id text not null,
  prompt_kind text not null check (prompt_kind in ('workout_check_in', 'intervention_log')),
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'completed')),
  title text not null,
  body text not null,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, provider, provider_activity_id, prompt_kind)
);

create index if not exists activity_follow_up_prompts_athlete_status_idx
  on public.activity_follow_up_prompts (athlete_id, status, occurred_at desc);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes (id) on delete cascade,
  activity_id text,
  activity_provider text check (activity_provider in ('strava', 'garmin', 'trainingpeaks')),
  date date,
  intervention_type text,
  details text,
  dose_duration text,
  timing text,
  protocol_payload jsonb not null default '{}'::jsonb,
  assigned_protocol_id uuid references public.assigned_protocols (id) on delete set null,
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

create table if not exists public.race_outcomes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  linked_activity_id text,
  linked_activity_provider text check (linked_activity_provider in ('strava', 'garmin', 'trainingpeaks')),
  linked_activity_snapshot jsonb not null default '{}'::jsonb,
  race_name text not null,
  race_date date,
  race_type text,
  finish_outcome text,
  finish_time_minutes integer,
  goal_time_minutes integer,
  overall_rating integer check (overall_rating between 1 and 10),
  gi_distress_score integer check (gi_distress_score is null or gi_distress_score between 0 and 4),
  energy_management text,
  pacing_strategy text,
  primary_limiter text,
  peak_hr_bpm integer,
  avg_hr_bpm integer,
  avg_carbs_g_per_hr numeric(6,2),
  total_fluid_l numeric(5,2),
  heat_impact text,
  what_worked text,
  what_to_change text,
  would_use_again text,
  notes text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists race_outcomes_athlete_id_idx
  on public.race_outcomes (athlete_id, race_date desc);

create index if not exists race_outcomes_athlete_linked_activity_idx
  on public.race_outcomes (athlete_id, linked_activity_provider, linked_activity_id);

create or replace function public.update_race_outcomes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists race_outcomes_updated_at on public.race_outcomes;
create trigger race_outcomes_updated_at
  before update on public.race_outcomes
  for each row execute function public.update_race_outcomes_updated_at();

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

create index if not exists idx_interventions_assigned_protocol_id
  on public.interventions (assigned_protocol_id);

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
  max_athletes integer not null default 25,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text not null default 'inactive',
  subscription_tier text not null default 'coach_monthly',
  subscription_current_period_end timestamptz,
  subscription_cancel_at timestamptz,
  subscription_cancel_at_period_end boolean not null default false,
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
alter table public.strava_activities disable row level security;
alter table public.provider_connections disable row level security;
alter table public.activity_events disable row level security;
alter table public.activity_follow_up_prompts disable row level security;
alter table public.races disable row level security;
alter table public.race_outcomes disable row level security;
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
grant select, insert, update, delete on table public.strava_activities to anon, authenticated;
grant select, insert, update, delete on table public.provider_connections to anon, authenticated;
grant select, insert, update, delete on table public.activity_events to anon, authenticated;
grant select, insert, update, delete on table public.activity_follow_up_prompts to anon, authenticated;
grant select, insert, update, delete on table public.races to anon, authenticated;
grant select, insert, update, delete on table public.race_outcomes to anon, authenticated;
grant select, insert, update, delete on table public.coach_profiles to anon, authenticated;
grant select, insert, update, delete on table public.coach_athlete_links to anon, authenticated;
grant select, insert, update, delete on table public.coach_protocol_assignments to anon, authenticated;
grant select, insert, update, delete on table public.race_catalog to anon, authenticated;
grant select on table public.research_library_entries to anon, authenticated;

create or replace function public.calculate_protocol_compliance(protocol_uuid uuid)
returns table (
  protocol_id uuid,
  expected_entries integer,
  actual_entries integer,
  compliance_percent integer,
  weeks_elapsed integer
)
language plpgsql
security definer
as $$
declare
  effective_end date;
begin
  protocol_id := protocol_uuid;

  if current_date < (select start_date from public.assigned_protocols where id = protocol_uuid) then
    weeks_elapsed := 0;
  else
    effective_end := least(
      current_date,
      (select end_date from public.assigned_protocols where id = protocol_uuid)
    );
    weeks_elapsed := greatest(
      1,
      ceil(
        (
          (
            effective_end - (select start_date from public.assigned_protocols where id = protocol_uuid)
          ) + 1
        )::numeric / 7.0
      )::integer
    );
  end if;

  if weeks_elapsed = 0 then
    expected_entries := 0;
  elsif jsonb_typeof((select instructions from public.assigned_protocols where id = protocol_uuid) -> 'weekly_blocks') = 'array' then
    select coalesce(
      sum(
        case
          when nullif(block ->> 'frequency_per_week', '') is null then 0
          else (block ->> 'frequency_per_week')::integer
        end
      ),
      0
    )
    into expected_entries
    from jsonb_array_elements((select instructions from public.assigned_protocols where id = protocol_uuid) -> 'weekly_blocks') as block
    where coalesce(nullif(block ->> 'week_number', '')::integer, 0) <= weeks_elapsed;

    if expected_entries = 0 then
      expected_entries := weeks_elapsed;
    end if;
  else
    expected_entries := weeks_elapsed;
  end if;

  select count(*)::integer
  into actual_entries
  from public.interventions
  where athlete_id = (select athlete_id from public.assigned_protocols where id = protocol_uuid)
    and (
      assigned_protocol_id = protocol_uuid
      or (
        assigned_protocol_id is null
        and intervention_type = (select protocol_type from public.assigned_protocols where id = protocol_uuid)
        and date between
          (select start_date from public.assigned_protocols where id = protocol_uuid)
          and
          (select end_date from public.assigned_protocols where id = protocol_uuid)
      )
    );

  compliance_percent := case
    when expected_entries <= 0 then 0
    else least(100, round((actual_entries::numeric / expected_entries::numeric) * 100))::integer
  end;

  return query
  select protocol_id, expected_entries, actual_entries, compliance_percent, weeks_elapsed;
end;
$$;
