-- Prepare only: apply to an isolated database for tests. Production rollout is
-- a separate approval. No participant records are changed by this migration.
begin;
set local lock_timeout = '5s';

create table public.workout_week_copies (
  actor_id uuid not null references public.athletes(id) on delete cascade,
  request_id uuid not null,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  from_week date not null,
  to_week date not null,
  workout_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id),
  check (from_week <> to_week)
);
alter table public.workout_week_copies enable row level security;
revoke all on public.workout_week_copies from public, anon, authenticated;
grant select, insert, update, delete on public.workout_week_copies to service_role;

-- Adds a restrictive condition to existing policies, rather than granting any
-- new access. Service callers must also apply the API visibility boundary.
create policy "planned_workouts: private draft boundary"
on public.planned_workouts as restrictive for all to anon, authenticated
using (
  visibility = 'athlete_visible'
  or exists (
    select 1 from public.coach_profiles cp
    join public.athletes a on a.id = cp.athlete_id
    join public.coach_athlete_relationships r on r.coach_id = cp.id
      and r.athlete_id = planned_workouts.athlete_id and r.status = 'active'
    where cp.id = planned_workouts.coach_id and a.supabase_user_id = auth.uid()
  )
)
with check (
  visibility = 'athlete_visible'
  or exists (
    select 1 from public.coach_profiles cp
    join public.athletes a on a.id = cp.athlete_id
    join public.coach_athlete_relationships r on r.coach_id = cp.id
      and r.athlete_id = planned_workouts.athlete_id and r.status = 'active'
    where cp.id = planned_workouts.coach_id and a.supabase_user_id = auth.uid()
  )
);

create function public.copy_planned_workout_week(
  p_actor_id uuid, p_athlete_id uuid, p_request_id uuid, p_from date, p_to date
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  coach uuid;
  operation public.workout_week_copies;
  created_ids uuid[];
  result jsonb;
  replayed boolean := false;
begin
  if p_actor_id is null or p_athlete_id is null or p_request_id is null
    or p_from is null or p_to is null or p_from = p_to then
    raise exception 'Invalid copy request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.athletes where id = p_actor_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_actor_id <> p_athlete_id then
    select id into coach from public.coach_profiles where athlete_id = p_actor_id;
    if coach is null then raise exception 'Not allowed' using errcode = '42501'; end if;
    -- Hold authorization until this transaction completes; concurrent revocation
    -- cannot interleave between its check and the copy.
    perform 1 from public.coach_athlete_relationships
      where coach_id = coach and athlete_id = p_athlete_id and status = 'active' for share;
    if not found then raise exception 'Not allowed' using errcode = '42501'; end if;
  end if;

  -- Unique-index arbitration serializes identical requests. Insert and copied
  -- rows commit together, so neither a partial copy nor an orphan retry exists.
  insert into public.workout_week_copies(actor_id, request_id, athlete_id, from_week, to_week)
    values(p_actor_id, p_request_id, p_athlete_id, p_from, p_to)
    on conflict(actor_id, request_id) do nothing returning * into operation;
  if not found then
    select * into operation from public.workout_week_copies
      where actor_id = p_actor_id and request_id = p_request_id for update;
    if operation.athlete_id <> p_athlete_id or operation.from_week <> p_from or operation.to_week <> p_to then
      raise exception 'Copy request already used for a different operation' using errcode = 'PT409';
    end if;
    created_ids := operation.workout_ids;
    replayed := true;
  else
    with copies as (
      insert into public.planned_workouts (
        athlete_id, coach_id, workout_date, sport, title, description, structure,
        planned_duration_min, planned_distance_km, planned_distance_unit, planned_tss,
        order_index, library_workout_id, objective, coach_instructions, target_metric,
        planned_if, visibility
      ) select p_athlete_id, coach, w.workout_date + (p_to - p_from), w.sport,
        w.title, w.description, w.structure, w.planned_duration_min, w.planned_distance_km,
        w.planned_distance_unit, w.planned_tss, w.order_index, w.library_workout_id,
        w.objective, w.coach_instructions, w.target_metric, w.planned_if, w.visibility
      from public.planned_workouts w
      where w.athlete_id = p_athlete_id and w.workout_date between p_from and p_from + 6
        and (w.visibility = 'athlete_visible' or (coach is not null and w.coach_id = coach))
      order by w.workout_date, w.order_index, w.id
      returning id
    ) select array_agg(id) into created_ids from copies;
    if created_ids is null then raise exception 'No visible source workouts' using errcode = '22023'; end if;
    update public.workout_week_copies set workout_ids = created_ids
      where actor_id = p_actor_id and request_id = p_request_id;
  end if;
  -- Replay reads current rows: deleting a copied workout never resurrects it.
  -- Recheck visibility so an athlete cannot recover a subsequently-private row.
  select coalesce(jsonb_agg(to_jsonb(w) order by w.workout_date, w.order_index, w.id), '[]'::jsonb)
    into result from public.planned_workouts w
    where w.id = any(created_ids) and w.athlete_id = p_athlete_id
      and (w.visibility = 'athlete_visible' or (coach is not null and w.coach_id = coach));
  return jsonb_build_object('workouts', result, 'replayed', replayed);
end $$;
revoke all on function public.copy_planned_workout_week(uuid, uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.copy_planned_workout_week(uuid, uuid, uuid, date, date) to service_role;
commit;
