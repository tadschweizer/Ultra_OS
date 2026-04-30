create table if not exists coach_shared_docs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  doc_type text not null check (doc_type in ('text', 'link', 'file')),
  content text,
  resource_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_shared_docs_athlete_id on coach_shared_docs(athlete_id);
create index if not exists idx_coach_shared_docs_coach_id on coach_shared_docs(coach_id);

create trigger trg_coach_shared_docs_updated_at
before update on coach_shared_docs
for each row execute function set_updated_at();

alter table coach_shared_docs enable row level security;

create policy "athletes can read their shared docs"
on coach_shared_docs for select
using (athlete_id = auth.uid());

create policy "coaches manage roster shared docs"
on coach_shared_docs for all
using (coach_id in (select cp.id from coach_profiles cp where cp.athlete_id = auth.uid()))
with check (coach_id in (select cp.id from coach_profiles cp where cp.athlete_id = auth.uid()));
