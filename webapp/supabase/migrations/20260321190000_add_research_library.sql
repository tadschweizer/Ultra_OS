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

alter table public.research_library_entries enable row level security;

drop policy if exists "Published research entries are public readable" on public.research_library_entries;
create policy "Published research entries are public readable"
  on public.research_library_entries
  for select
  to anon, authenticated
  using (published = true);

grant select on table public.research_library_entries to anon, authenticated;
