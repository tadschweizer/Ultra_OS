create table if not exists public.connector_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete cascade,
  provider text not null,
  event_type text not null default 'sync',
  external_id text,
  payload_raw jsonb not null,
  normalized_metrics jsonb not null,
  sync_cursor jsonb,
  data_quality_score numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_connector_ingestion_provider_created
  on public.connector_ingestion_events (provider, created_at desc);

create index if not exists idx_connector_ingestion_athlete_created
  on public.connector_ingestion_events (athlete_id, created_at desc);

create table if not exists public.connector_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  athlete_id uuid references public.athletes(id) on delete cascade,
  cadence text not null check (cadence in ('hourly_incremental', 'nightly_full')),
  status text not null default 'queued' check (status in ('queued', 'running', 'retry', 'dead_letter', 'complete')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
