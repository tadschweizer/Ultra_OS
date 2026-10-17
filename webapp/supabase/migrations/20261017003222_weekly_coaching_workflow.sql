-- Local preparation only. Apply before the corresponding release, under separate authorization.
begin;
set local lock_timeout = '5s';
alter table public.planned_workouts add column completion_revision bigint not null default 0,
  add column response_requested boolean not null default false;

create table public.workout_coach_reviews (
  workout_id uuid not null references public.planned_workouts(id) on delete cascade,
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  reviewed_revision bigint not null default -1,
  reviewed_at timestamptz,
  resolved_revision bigint not null default -1,
  primary key(workout_id, coach_id)
);
create table public.workout_week_publications (
  actor_id uuid not null references public.athletes(id) on delete cascade,
  request_id uuid not null,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  payload jsonb not null,
  workout_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key(actor_id, request_id)
);
create table public.workout_review_actions (
  actor_id uuid not null references public.athletes(id) on delete cascade,
  workout_id uuid not null references public.planned_workouts(id) on delete cascade,
  request_id uuid not null, payload jsonb not null, result jsonb,
  primary key(actor_id,request_id)
);
alter table public.workout_review_actions enable row level security;
revoke all on public.workout_review_actions from public,anon,authenticated;
grant select,insert,update,delete on public.workout_review_actions to service_role;
alter table public.workout_coach_reviews enable row level security;
alter table public.workout_week_publications enable row level security;
revoke all on public.workout_coach_reviews, public.workout_week_publications from public, anon, authenticated;
grant select, insert, update, delete on public.workout_coach_reviews, public.workout_week_publications to service_role;
create index planned_workout_review_queue on public.planned_workouts(coach_id, workout_date, id) where visibility = 'athlete_visible';

create function public.bump_workout_completion_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('service_role','postgres') then new.completion_revision:=old.completion_revision; end if;
  if row(new.status,new.completed_activity_id,new.completed_duration_min,new.completed_distance_km,new.athlete_rpe,new.athlete_comment)
    is distinct from row(old.status,old.completed_activity_id,old.completed_duration_min,old.completed_distance_km,old.athlete_rpe,old.athlete_comment) then
    new.completion_revision := old.completion_revision + 1;
  end if;
  return new;
end $$;
create trigger workout_completion_revision before update on public.planned_workouts for each row execute function public.bump_workout_completion_revision();
create function public.bump_workout_comment_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.sender_role='athlete' and new.planned_workout_id is not null then
    update public.planned_workouts set completion_revision=completion_revision+1 where id=new.planned_workout_id;
  end if;
  return new;
end $$;
create trigger workout_comment_revision after insert on public.workout_comments for each row execute function public.bump_workout_comment_revision();
revoke all on function public.bump_workout_completion_revision(), public.bump_workout_comment_revision() from public,anon,authenticated;

create function public.publish_coaching_week(p_actor_id uuid, p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  coach uuid; target uuid := (p_payload->>'athlete_id')::uuid; request uuid := (p_payload->>'request_id')::uuid;
  start_day date := (p_payload->>'week_start')::date; entry jsonb; p jsonb; source jsonb; ids uuid[] := '{}'; new_id uuid;
  operation public.workout_week_publications; occupied jsonb;
begin
  select id into coach from public.coach_profiles where athlete_id=p_actor_id;
  if coach is null or request is null or start_day is null then raise exception 'Invalid planning request' using errcode='22023'; end if;
  perform 1 from public.coach_athlete_relationships where coach_id=coach and athlete_id=target and status='active' and removed_at is null and (expires_at is null or expires_at>now()) for share;
  if not found then raise exception 'Relationship no longer active' using errcode='42501'; end if;
  if jsonb_typeof(p_payload->'entries') <> 'array' or jsonb_array_length(p_payload->'entries') not between 1 and 100
    or p_payload->>'targets_confirmed' is distinct from 'true' then raise exception 'Invalid prescriptions' using errcode='22023'; end if;
  insert into public.workout_week_publications(actor_id,request_id,athlete_id,payload) values(p_actor_id,request,target,p_payload)
    on conflict do nothing returning * into operation;
  if not found then
    select * into operation from public.workout_week_publications where actor_id=p_actor_id and request_id=request for update;
    if operation.payload <> p_payload then raise exception 'Retry has different details' using errcode='PT409'; end if;
    return jsonb_build_object('workout_ids',operation.workout_ids,'replayed',true);
  end if;
  -- Coordinate with all other plan writers while validating destination occupancy.
  lock table public.planned_workouts in share row exclusive mode;
  select coalesce(jsonb_agg(w.id::text order by w.id::text),'[]') into occupied from public.planned_workouts w
    where w.athlete_id=target and w.workout_date between start_day and start_day+6
      and (w.visibility='athlete_visible' or w.coach_id=coach);
  if occupied <> coalesce(p_payload->'occupied_ids','[]') then raise exception 'Destination changed; refresh preview' using errcode='PT409'; end if;
  for entry in select value from jsonb_array_elements(p_payload->'entries') loop
    source := null;
    if entry->>'source_type'='library' then
      select to_jsonb(l) into source from public.workout_library l where l.id=(entry->>'source_id')::uuid and l.coach_id=coach for share;
    elsif entry->>'source_type'='workout' then
      select to_jsonb(w) into source from public.planned_workouts w where w.id=(entry->>'source_id')::uuid and w.coach_id=coach for share;
      if source is not null then
        perform 1 from public.coach_athlete_relationships where coach_id=coach and athlete_id=(source->>'athlete_id')::uuid and status='active' and removed_at is null and (expires_at is null or expires_at>now()) for share;
        if not found then raise exception 'Source relationship no longer active' using errcode='42501'; end if;
      end if;
    end if;
    if source is null then raise exception 'Source unavailable to this coach' using errcode='42501'; end if;
    if (source->>'updated_at')::timestamptz is distinct from (entry->>'source_updated_at')::timestamptz then raise exception 'Source changed; refresh preview' using errcode='PT409'; end if;
    p := entry->'prescription';
    if (p->>'workout_date')::date not between start_day and start_day+6 or nullif(btrim(p->>'title'),'') is null then
      raise exception 'Invalid workout' using errcode='22023'; end if;
    if exists(select 1 from public.planned_workouts w where w.athlete_id=target and w.workout_date=(p->>'workout_date')::date
      and w.id not in (select unnest(ids)) and (w.visibility='athlete_visible' or w.coach_id=coach))
      and p_payload->>'allow_occupied' is distinct from 'true' then raise exception 'Confirm adding to occupied days' using errcode='PT409'; end if;
    insert into public.planned_workouts(athlete_id,coach_id,workout_date,sport,title,description,structure,planned_duration_min,
      planned_distance_km,planned_distance_unit,planned_tss,order_index,objective,coach_instructions,target_metric,planned_if,visibility,status)
      values(target,coach,(p->>'workout_date')::date,p->>'sport',p->>'title',p->>'description',coalesce(p->'structure','[]'),
      (p->>'planned_duration_min')::numeric,(p->>'planned_distance_km')::numeric,coalesce(p->>'planned_distance_unit','mi'),
      (p->>'planned_tss')::numeric,coalesce((p->>'order_index')::integer,0),p->>'objective',p->>'coach_instructions',
      coalesce(p->>'target_metric','duration'),(p->>'planned_if')::numeric,'athlete_visible','planned') returning id into new_id;
    ids := array_append(ids,new_id);
  end loop;
  update public.workout_week_publications set workout_ids=ids where actor_id=p_actor_id and request_id=request;
  return jsonb_build_object('workout_ids',ids,'replayed',false);
end $$;
revoke all on function public.publish_coaching_week(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.publish_coaching_week(uuid,jsonb) to service_role;

-- A review acknowledges a specific completion revision, never merely a read receipt.
create function public.coaching_workout_review(p_actor_id uuid,p_workout_id uuid,p_action text default 'get',p_revision bigint default null,p_reply text default null,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.planned_workouts; r public.workout_coach_reviews; coach uuid; is_athlete boolean;
  action_row public.workout_review_actions; action_payload jsonb; review_result jsonb;
begin
  select * into w from public.planned_workouts where id=p_workout_id for update;
  if not found then raise exception 'Workout unavailable' using errcode='42501'; end if;
  is_athlete := p_actor_id=w.athlete_id;
  select id into coach from public.coach_profiles where athlete_id=p_actor_id;
  if w.visibility<>'athlete_visible' or w.coach_id is null then raise exception 'Published assigned workout required' using errcode='42501'; end if;
  if not is_athlete and coach is distinct from w.coach_id then raise exception 'Assigning coach required' using errcode='42501'; end if;
  perform 1 from public.coach_athlete_relationships where coach_id=w.coach_id and athlete_id=w.athlete_id and status='active' and removed_at is null and (expires_at is null or expires_at>now()) for share;
  if not found then raise exception 'Relationship no longer active' using errcode='42501'; end if;
  if p_action<>'get' then
    if p_request_id is null then raise exception 'Retry identifier required' using errcode='22023'; end if;
    action_payload:=jsonb_build_object('workout',p_workout_id,'action',p_action,'revision',p_revision,'reply',p_reply);
    insert into public.workout_review_actions(actor_id,workout_id,request_id,payload) values(p_actor_id,w.id,p_request_id,action_payload)
      on conflict do nothing returning * into action_row;
    if not found then
      select * into action_row from public.workout_review_actions where actor_id=p_actor_id and request_id=p_request_id for update;
      if action_row.payload<>action_payload then raise exception 'Retry details changed' using errcode='PT409'; end if;
      return action_row.result;
    end if;
  end if;
  if p_action<>'get' and p_revision is distinct from w.completion_revision then raise exception 'New feedback arrived; review it first' using errcode='PT409'; end if;
  if p_action='request' and is_athlete then
    -- Re-requesting after a prior answer is a new revision even if the flag is already true.
    update public.planned_workouts set response_requested=true,completion_revision=completion_revision+1 where id=w.id returning * into w;
  elsif p_action in ('review','reply') and not is_athlete then
    if p_action='reply' then
      if nullif(btrim(p_reply),'') is null or length(p_reply)>5000 then raise exception 'Write a reply of 1–5000 characters' using errcode='22023'; end if;
      insert into public.workout_comments(planned_workout_id,athlete_id,coach_id,author_athlete_id,sender_role,body)
        values(w.id,w.athlete_id,w.coach_id,p_actor_id,'coach',btrim(p_reply));
      update public.planned_workouts set response_requested=false where id=w.id returning * into w;
    end if;
    insert into public.workout_coach_reviews(workout_id,coach_id,reviewed_revision,reviewed_at,resolved_revision)
      values(w.id,w.coach_id,w.completion_revision,now(),case when p_action='reply' then w.completion_revision else -1 end)
      on conflict(workout_id,coach_id) do update set reviewed_revision=excluded.reviewed_revision,reviewed_at=excluded.reviewed_at,
        resolved_revision=case when p_action='reply' then excluded.resolved_revision else workout_coach_reviews.resolved_revision end;
  elsif p_action<>'get' then raise exception 'Action not allowed' using errcode='42501'; end if;
  select * into r from public.workout_coach_reviews where workout_id=w.id and coach_id=w.coach_id;
  review_result:=jsonb_build_object('revision',w.completion_revision,'reviewed',coalesce(r.reviewed_revision=w.completion_revision,false),
    'reviewed_at',r.reviewed_at,'response_requested',w.response_requested,
    'request_open',w.response_requested and coalesce(r.resolved_revision<w.completion_revision,true));
  if p_action<>'get' then update public.workout_review_actions set result=review_result where actor_id=p_actor_id and request_id=p_request_id; end if;
  return review_result;
end $$;
revoke all on function public.coaching_workout_review(uuid,uuid,text,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.coaching_workout_review(uuid,uuid,text,bigint,text,uuid) to service_role;

create function public.coaching_review_queue(p_actor_id uuid,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$
  with items as (
    select w.id,w.athlete_id,a.name,w.workout_date,w.title,w.status,w.completed_duration_min,w.completed_distance_km,w.athlete_rpe,
      w.response_requested and coalesce(r.resolved_revision<w.completion_revision,true) as request_open
    from public.planned_workouts w join public.coach_profiles c on c.id=w.coach_id and c.athlete_id=p_actor_id
    join public.athletes a on a.id=w.athlete_id
    left join public.workout_coach_reviews r on r.workout_id=w.id and r.coach_id=c.id
    where w.visibility='athlete_visible' and exists(select 1 from public.coach_athlete_relationships cr where cr.coach_id=c.id and cr.athlete_id=w.athlete_id and cr.status='active' and cr.removed_at is null and (cr.expires_at is null or cr.expires_at>now()))
      and ((w.status='completed' and coalesce(r.reviewed_revision<w.completion_revision,true))
        or (w.response_requested and coalesce(r.resolved_revision<w.completion_revision,true)))
    order by request_open desc,w.workout_date,w.id limit 51 offset greatest(p_offset,0)
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)) from (select * from items limit 50)i),'[]'),
    'has_more',(select count(*)>50 from items));
$$;
revoke all on function public.coaching_review_queue(uuid,integer) from public,anon,authenticated;
grant execute on function public.coaching_review_queue(uuid,integer) to service_role;
create function public.coaching_review_counts(p_actor_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (
   select w.athlete_id,
     count(*) filter(where w.status='completed' and coalesce(r.reviewed_revision<w.completion_revision,true)) as pending_reviews,
     count(*) filter(where w.response_requested and coalesce(r.resolved_revision<w.completion_revision,true)) as response_requests
   from public.planned_workouts w join public.coach_profiles cp on cp.id=w.coach_id and cp.athlete_id=p_actor_id
   left join public.workout_coach_reviews r on r.workout_id=w.id and r.coach_id=cp.id
   where w.visibility='athlete_visible' and exists(select 1 from public.coach_athlete_relationships cr where cr.coach_id=cp.id and cr.athlete_id=w.athlete_id and cr.status='active' and cr.removed_at is null and (cr.expires_at is null or cr.expires_at>now()))
   group by w.athlete_id
 ) c;
$$;
revoke all on function public.coaching_review_counts(uuid) from public,anon,authenticated;
grant execute on function public.coaching_review_counts(uuid) to service_role;
commit;
