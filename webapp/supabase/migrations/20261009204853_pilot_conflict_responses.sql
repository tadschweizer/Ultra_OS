-- Application version conflicts must not use serialization_failure (40001).
-- Hosted PostgREST retries that transient database error indefinitely. PT409
-- returns a stable conflict response; signatures, ownership and grants stay intact.
begin;
set local lock_timeout = '5s';
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

create or replace function public.save_message_draft(p_owner uuid, p_coach uuid, p_athlete uuid, p_role text,
  p_body text, p_template text, p_client_id uuid, p_expected uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.message_drafts; old public.message_drafts;
begin
  perform public.authorize_message_conversation(p_owner,p_coach,p_athlete,p_role);
  if p_body is null or char_length(p_body)>5000 or char_length(coalesce(p_template,''))>100 then
    raise exception 'Invalid draft' using errcode='22023';
  end if;
  -- Serialize same-conversation inserts as well as updates, including absent rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text || p_coach::text || p_athlete::text || p_role,0));
  select * into old from public.message_drafts where owner_id=p_owner and coach_id=p_coach and athlete_id=p_athlete and sender_role=p_role for update;
  -- Sending atomically removes the draft. If its response was lost, allow the
  -- same signed sender to prepare an exact retry without recreating that draft.
  if old.version is null and p_client_id is not null and exists(
    select 1 from public.coach_messages where id=p_client_id and coach_id=p_coach and athlete_id=p_athlete
      and sender_role=p_role and message_body=trim(p_body) and message_template_key is not distinct from p_template
  ) then
    return jsonb_build_object('body',p_body,'template_key',p_template,'client_message_id',p_client_id,'version',null);
  end if;
  if old.version is distinct from p_expected then
    -- A lost response can retry the exact original save without rewriting it.
    if old.body=p_body and old.template_key is not distinct from p_template and old.client_message_id is not distinct from p_client_id then return to_jsonb(old); end if;
    raise exception 'Draft changed in another session' using errcode='PT409';
  end if;
  insert into public.message_drafts(owner_id,coach_id,athlete_id,sender_role,body,template_key,client_message_id)
    values(p_owner,p_coach,p_athlete,p_role,p_body,p_template,p_client_id)
    on conflict(owner_id,coach_id,athlete_id,sender_role) do update set body=excluded.body,template_key=excluded.template_key,
      client_message_id=excluded.client_message_id,version=gen_random_uuid(),updated_at=now() returning * into saved;
  return to_jsonb(saved);
end $$;

create or replace function public.send_direct_message(p_owner uuid, p_coach uuid, p_athlete uuid, p_role text,
  p_body text, p_template text, p_client_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.coach_messages; recipient uuid; pref public.message_preferences; legacy jsonb;
begin
  perform public.authorize_message_conversation(p_owner,p_coach,p_athlete,p_role);
  if p_client_id is null or p_body is null or char_length(trim(p_body))=0 or char_length(p_body)>5000 or char_length(coalesce(p_template,''))>100 then
    raise exception 'Invalid message' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text || p_coach::text || p_athlete::text || p_role,0));
  insert into public.coach_messages(id,coach_id,athlete_id,sender_role,message_body,message_template_key)
    values(p_client_id,p_coach,p_athlete,p_role,trim(p_body),p_template) on conflict(id) do nothing returning * into saved;
  if saved.id is null then
    select * into saved from public.coach_messages where id=p_client_id and coach_id=p_coach and athlete_id=p_athlete and sender_role=p_role;
    if saved.id is null or saved.message_body<>trim(p_body) or saved.message_template_key is distinct from p_template then
      raise exception 'Retry does not match original message' using errcode='PT409';
    end if;
    return jsonb_build_object('message',to_jsonb(saved),'replayed',true);
  end if;
  recipient := case when p_role='coach' then p_athlete else (select athlete_id from public.coach_profiles where id=p_coach) end;
  select * into pref from public.message_preferences where athlete_id=recipient;
  insert into public.message_email_deliveries(message_id,recipient_id,recipient_role,status,failure_category)
    values(saved.id,recipient,case when p_role='coach' then 'athlete' else 'coach' end,
      case when coalesce(pref.email_enabled,false) then 'pending' else 'skipped' end,
      case when coalesce(pref.email_enabled,false) then null else 'disabled' end);
  if p_role='athlete' then
    select notification_preferences into legacy from public.athletes where id=recipient;
    if coalesce(pref.badge_enabled,true) and coalesce(legacy->'athlete_message','true'::jsonb) <> 'false'::jsonb then
      insert into public.coach_notifications(coach_id,athlete_id,notification_type,title,body,entity_type,entity_id)
        values(p_coach,p_athlete,'athlete_message','New athlete message','Open Messages to read the reply.','coach_message',saved.id);
    end if;
  end if;
  delete from public.message_drafts where owner_id=p_owner and coach_id=p_coach and athlete_id=p_athlete and sender_role=p_role
    and client_message_id=p_client_id and trim(body)=trim(p_body) and template_key is not distinct from p_template;
  return jsonb_build_object('message',to_jsonb(saved),'replayed',false);
end $$;
commit;
