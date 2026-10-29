-- Prepared locally; production application requires specific owner approval.
begin;
set local lock_timeout = '5s';

-- Server-only authorization. The caller supplies the real signed actor, never
-- the target athlete as an impersonated actor. Relationship locks prevent a
-- concurrent removal from racing an authorized write.
create function public.authorize_calendar_workout(p_actor uuid, p_workout uuid, p_move boolean)
returns public.planned_workouts language plpgsql security invoker set search_path='' as $$
declare w public.planned_workouts; target uuid; coach uuid;
begin
  select athlete_id into target from public.planned_workouts where id=p_workout;
  if target is null then raise exception 'Workout unavailable' using errcode='42501'; end if;
  perform 1 from public.athletes where id=target for update;
  select * into w from public.planned_workouts where id=p_workout and athlete_id=target for update;
  if not found then raise exception 'Workout unavailable' using errcode='42501'; end if;
  if p_actor=w.athlete_id then
    if coalesce(w.visibility,'athlete_visible')<>'athlete_visible' then
      raise exception 'Workout unavailable' using errcode='42501';
    end if;
  else
    select id into coach from public.coach_profiles where athlete_id=p_actor;
    if coach is null or (p_move and coach is distinct from w.coach_id)
      or (coalesce(w.visibility,'athlete_visible')<>'athlete_visible' and coach is distinct from w.coach_id) then
      raise exception 'Workout unavailable' using errcode='42501';
    end if;
    perform 1 from public.coach_athlete_relationships where coach_id=coach and athlete_id=target
      and status='active' and removed_at is null and (expires_at is null or expires_at>now()) for share;
    if not found then raise exception 'Relationship inactive' using errcode='42501'; end if;
  end if;
  return w;
end $$;
revoke all on function public.authorize_calendar_workout(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.authorize_calendar_workout(uuid,uuid,boolean) to service_role;

create function public.move_calendar_workout(p_actor_id uuid,p_workout_id uuid,p_date date,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.planned_workouts;
begin
  if p_date is null or p_date not between date '1900-01-01' and date '2200-12-31' or p_expected_updated_at is null then
    raise exception 'Invalid move' using errcode='22023';
  end if;
  select * into w from public.authorize_calendar_workout(p_actor_id,p_workout_id,true);
  if w.status<>'planned' or w.completed_activity_id is not null then
    raise exception 'Only unfinished plans can move' using errcode='PT409';
  end if;
  -- Identical replay after response loss is harmless, even with an old version.
  if w.workout_date=p_date then return to_jsonb(w); end if;
  if w.updated_at is distinct from p_expected_updated_at then
    raise exception 'Workout changed' using errcode='PT409';
  end if;
  update public.planned_workouts set workout_date=p_date,updated_at=clock_timestamp()
    where id=w.id returning * into w;
  return to_jsonb(w);
end $$;
revoke all on function public.move_calendar_workout(uuid,uuid,date,timestamptz) from public,anon,authenticated;
grant execute on function public.move_calendar_workout(uuid,uuid,date,timestamptz) to service_role;
create or replace function public.decide_workout_activity_match(
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
  select * into w from public.authorize_calendar_workout(p_actor_id,p_workout_id,false);
  if p_action = 'confirm' then
    select * into a from public.strava_activities
      where id = p_activity_id and athlete_id = w.athlete_id for share;
    if not found then
      raise exception 'Activity not found' using errcode = '22023';
    end if;
    if exists (select 1 from public.planned_workouts where athlete_id = w.athlete_id
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
    raise exception 'Workout changed' using errcode = 'PT409';
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


revoke all on function public.decide_workout_activity_match(uuid,uuid,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.decide_workout_activity_match(uuid,uuid,text,uuid,timestamptz) to service_role;
commit;
