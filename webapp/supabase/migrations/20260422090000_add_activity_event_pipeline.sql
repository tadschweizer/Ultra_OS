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

alter table public.provider_connections disable row level security;
alter table public.activity_events disable row level security;
alter table public.activity_follow_up_prompts disable row level security;

grant select, insert, update, delete on table public.provider_connections to anon, authenticated;
grant select, insert, update, delete on table public.activity_events to anon, authenticated;
grant select, insert, update, delete on table public.activity_follow_up_prompts to anon, authenticated;
