create table if not exists public.integration_interest (
  id bigserial primary key,
  athlete_id bigint references public.athletes(id) on delete set null,
  email text not null,
  source_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists integration_interest_email_source_name_key
  on public.integration_interest (email, source_name);

create index if not exists integration_interest_source_name_idx
  on public.integration_interest (source_name);
