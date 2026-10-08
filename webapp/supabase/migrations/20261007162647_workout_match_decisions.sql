-- Saved athlete decisions override the calendar's automatic suggestions.
-- Stop for duplicate legacy links rather than silently rewriting training history.
alter table public.planned_workouts
  add column activity_match_mode text not null default 'auto'
  check (activity_match_mode in ('auto', 'manual'));

update public.planned_workouts set activity_match_mode = 'manual'
where status <> 'planned' or completed_activity_id is not null;

create unique index planned_workouts_one_activity_per_athlete
  on public.planned_workouts (athlete_id, completed_activity_id)
  where completed_activity_id is not null;

-- Invoked only by the signed-session application handler. The owner is taken
-- from that session, never from a client-supplied athlete_id.
create function public.decide_workout_activity_match(
  p_actor_id uuid, p_workout_id uuid, p_action text,
  p_activity_id uuid, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  w public.planned_workouts%rowtype;
  a public.strava_activities%rowtype;
begin
  if p_action is null or p_action not in ('confirm', 'reject', 'auto') then
    raise exception 'Invalid match decision' using errcode = '22023';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Workout version required' using errcode = '22023';
  end if;
  -- Serialize link decisions for this athlete. The unique index also protects
  -- against other application writers and concurrent links to different plans.
  perform 1 from public.athletes where id = p_actor_id for update;
  select * into w from public.planned_workouts
    where id = p_workout_id and athlete_id = p_actor_id for update;
  if not found then
    raise exception 'Workout not found' using errcode = '42501';
  end if;
  if p_action = 'confirm' then
    select * into a from public.strava_activities
      where id = p_activity_id and athlete_id = p_actor_id for share;
    if not found then
      raise exception 'Activity not found' using errcode = '22023';
    end if;
    if exists (select 1 from public.planned_workouts where athlete_id = p_actor_id
      and completed_activity_id = p_activity_id::text and id <> p_workout_id) then
      raise exception 'Activity already linked' using errcode = '23505';
    end if;
    -- An identical retry after a lost response must not rewrite the actuals.
    if w.completed_activity_id = p_activity_id::text and w.status = 'completed'
      and w.activity_match_mode = 'manual' then return to_jsonb(w); end if;
  elsif w.completed_activity_id is null and w.status = 'planned'
    and w.completed_duration_min is null and w.completed_distance_km is null
    and w.activity_match_mode = (case when p_action = 'auto' then 'auto' else 'manual' end) then
    return to_jsonb(w);
  end if;
  if w.updated_at <> p_expected_updated_at then
    raise exception 'Workout changed' using errcode = '40001';
  end if;
  update public.planned_workouts set
    activity_match_mode = case when p_action = 'auto' then 'auto' else 'manual' end,
    completed_activity_id = case when p_action = 'confirm' then a.id::text else null end,
    status = case when p_action = 'confirm' then 'completed' else 'planned' end,
    completed_duration_min = case when p_action = 'confirm' then round(a.moving_time::numeric / 60, 1) else null end,
    completed_distance_km = case when p_action = 'confirm' then round(a.distance::numeric / 1000, 2) else null end,
    updated_at = clock_timestamp()
    where id = p_workout_id returning * into w;
  -- Athlete notes/RPE and the coach's plan/feedback survive match correction.
  return to_jsonb(w);
end;
$$;

revoke all on function public.decide_workout_activity_match(uuid, uuid, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.decide_workout_activity_match(uuid, uuid, text, uuid, timestamptz)
  to service_role;
