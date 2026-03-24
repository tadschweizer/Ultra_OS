alter table public.interventions
add column if not exists protocol_payload jsonb not null default '{}'::jsonb;

