create table if not exists public.research_papers (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  title text not null,
  abstract text,
  doi text,
  pubmed_id text,
  openalex_id text,
  semantic_scholar_id text,
  journal text,
  authors text,
  publication_year integer,
  publication_date date,
  primary_url text,
  source_count integer not null default 1,
  citation_count integer not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.research_papers (id) on delete cascade,
  source_name text not null check (source_name in ('pubmed', 'openalex', 'semantic_scholar', 'europepmc', 'curated')),
  source_identifier text,
  source_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  unique (paper_id, source_name, source_identifier)
);

create table if not exists public.research_topic_queries (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null,
  topic_label text not null,
  query text not null unique,
  cadence text not null default 'weekly' check (cadence in ('daily', 'weekly', 'manual')),
  enabled boolean not null default true,
  last_ingested_at timestamptz,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_topic_summaries (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null unique,
  topic_label text not null,
  query text not null,
  confidence text not null default 'Early',
  bottom_line text not null,
  evidence_agrees text not null,
  uncertain_or_individual text not null,
  practical_protocol text not null,
  when_to_avoid text not null,
  best_fit text not null,
  paper_count integer not null default 0,
  generation_source text not null default 'deterministic',
  published boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'scheduled_ingest',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  query_count integer not null default 0,
  imported_count integer not null default 0,
  error_message text,
  result_payload jsonb not null default '{}'::jsonb
);

create table if not exists public.research_paper_scores (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.research_papers (id) on delete cascade,
  query text not null,
  relevance_score integer not null default 0,
  study_type_score integer not null default 0,
  recency_score integer not null default 0,
  citation_score integer not null default 0,
  practical_score integer not null default 0,
  sport_relevance jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, query)
);

create index if not exists research_papers_title_idx on public.research_papers using gin (to_tsvector('english', title));
create index if not exists research_papers_abstract_idx on public.research_papers using gin (to_tsvector('english', coalesce(abstract, '')));
create index if not exists research_papers_publication_year_idx on public.research_papers (publication_year desc nulls last);
create index if not exists research_topic_summaries_published_idx on public.research_topic_summaries (published, topic_key);
create index if not exists research_paper_scores_query_idx on public.research_paper_scores (query, relevance_score desc);

alter table public.research_papers enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_topic_queries enable row level security;
alter table public.research_topic_summaries enable row level security;
alter table public.research_ingestion_runs enable row level security;
alter table public.research_paper_scores enable row level security;

drop policy if exists "Research papers are public readable" on public.research_papers;
create policy "Research papers are public readable"
  on public.research_papers
  for select
  using (true);

drop policy if exists "Published research summaries are public readable" on public.research_topic_summaries;
create policy "Published research summaries are public readable"
  on public.research_topic_summaries
  for select
  using (published = true);

drop policy if exists "Research paper scores are public readable" on public.research_paper_scores;
create policy "Research paper scores are public readable"
  on public.research_paper_scores
  for select
  using (true);

grant select on table public.research_papers to anon, authenticated;
grant select on table public.research_topic_summaries to anon, authenticated;
grant select on table public.research_paper_scores to anon, authenticated;
