-- Weekly rollup snapshots for coach cohort/range analytics.
create table if not exists public.coach_weekly_kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  week_start date not null,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  intervention_type text,
  intervention_count integer not null default 0,
  avg_subjective_feel numeric,
  avg_physical_response numeric,
  avg_gi_response numeric,
  created_at timestamptz not null default now(),
  unique (coach_id, week_start, athlete_id, intervention_type)
);

create index if not exists idx_coach_weekly_kpi_snapshots_lookup
  on public.coach_weekly_kpi_snapshots (coach_id, week_start);

create materialized view if not exists public.coach_weekly_kpi_mv as
select
  car.coach_id,
  date_trunc('week', i.date::timestamp)::date as week_start,
  i.athlete_id,
  coalesce(i.intervention_type, 'unspecified') as intervention_type,
  count(*)::int as intervention_count,
  avg(i.subjective_feel)::numeric(6,2) as avg_subjective_feel,
  avg(i.physical_response)::numeric(6,2) as avg_physical_response,
  avg(i.gi_response)::numeric(6,2) as avg_gi_response
from public.interventions i
join public.coach_athlete_relationships car on car.athlete_id = i.athlete_id and car.status = 'active'
group by car.coach_id, week_start, i.athlete_id, coalesce(i.intervention_type, 'unspecified');

create unique index if not exists idx_coach_weekly_kpi_mv_unique
  on public.coach_weekly_kpi_mv (coach_id, week_start, athlete_id, intervention_type);

create or replace function public.get_coach_kpi_rollup(coach_uuid uuid)
returns table (
  at_risk_athletes integer,
  intervention_lift_score numeric,
  communication_sla_hours numeric
)
language sql
security definer
set search_path = public
as $$
with rel as (
  select athlete_id
  from coach_athlete_relationships
  where coach_id = coach_uuid and status = 'active'
),
recent as (
  select i.athlete_id, i.subjective_feel, i.inserted_at
  from interventions i
  join rel on rel.athlete_id = i.athlete_id
  where i.inserted_at >= now() - interval '42 day'
),
lift as (
  select
    avg(case when inserted_at >= now() - interval '14 day' then subjective_feel end) as recent_avg,
    avg(case when inserted_at < now() - interval '14 day' then subjective_feel end) as baseline_avg
  from recent
),
at_risk as (
  select count(*)::int as cnt
  from (
    select athlete_id
    from recent
    group by athlete_id
    having avg(case when inserted_at >= now() - interval '7 day' then subjective_feel end)
      < avg(case when inserted_at < now() - interval '7 day' then subjective_feel end)
  ) x
)
select
  coalesce((select cnt from at_risk), 0) as at_risk_athletes,
  coalesce(round(((select recent_avg from lift) - (select baseline_avg from lift))::numeric, 2), 0) as intervention_lift_score,
  null::numeric as communication_sla_hours;
$$;
