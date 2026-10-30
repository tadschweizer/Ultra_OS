-- Local preparation. Hosted application requires separate owner approval.
begin;
set local lock_timeout='5s';

create table public.uploaded_workout_coach_reviews (
  activity_id uuid not null references public.strava_activities(id) on delete cascade,
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  reviewed_revision text not null check(reviewed_revision ~ '^[a-f0-9]{32}$'),
  reviewed_at timestamptz not null default now(),
  primary key(activity_id,coach_id)
);
alter table public.uploaded_workout_coach_reviews enable row level security;
revoke all on public.uploaded_workout_coach_reviews from public,anon,authenticated,service_role;
grant select,insert,update on public.uploaded_workout_coach_reviews to service_role;
create index uploaded_workout_reviews_coach on public.uploaded_workout_coach_reviews(coach_id,activity_id);

-- Sync writes updated_at/synced_at even when nothing changed. Only actual
-- persisted summary changes reopen a review; never expose the source payload.
create function public.uploaded_workout_review_revision(a public.strava_activities)
returns text language sql immutable security invoker set search_path='' as $$
  select md5((to_jsonb(a)-array['updated_at','synced_at','inserted_at','raw_payload'])::text);
$$;
revoke all on function public.uploaded_workout_review_revision(public.strava_activities) from public,anon,authenticated;
grant execute on function public.uploaded_workout_review_revision(public.strava_activities) to service_role;

create function public.coaching_uploaded_activity_review(p_actor_id uuid,p_activity_id uuid,p_revision text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.strava_activities; c uuid; current_revision text; saved public.uploaded_workout_coach_reviews;
begin
  select * into a from public.strava_activities where id=p_activity_id for share;
  select id into c from public.coach_profiles where athlete_id=p_actor_id;
  if a.id is null or c is null then raise exception 'Activity unavailable' using errcode='42501'; end if;
  perform 1 from public.coach_athlete_relationships where coach_id=c and athlete_id=a.athlete_id
    and status='active' and removed_at is null and (expires_at is null or expires_at>now()) for share;
  if not found then raise exception 'Relationship inactive' using errcode='42501'; end if;
  current_revision:=public.uploaded_workout_review_revision(a);
  if p_revision is null or p_revision !~ '^[a-f0-9]{32}$' then raise exception 'Refresh the activity' using errcode='22023'; end if;
  if p_revision<>current_revision then raise exception 'Activity changed' using errcode='PT409'; end if;
  insert into public.uploaded_workout_coach_reviews(activity_id,coach_id,reviewed_revision)
    values(a.id,c,current_revision)
    on conflict(activity_id,coach_id) do update set reviewed_revision=excluded.reviewed_revision,reviewed_at=clock_timestamp()
      where uploaded_workout_coach_reviews.reviewed_revision<>excluded.reviewed_revision;
  select * into saved from public.uploaded_workout_coach_reviews where activity_id=a.id and coach_id=c;
  return jsonb_build_object('reviewed',true,'revision',saved.reviewed_revision,'reviewed_at',saved.reviewed_at);
end $$;
revoke all on function public.coaching_uploaded_activity_review(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.coaching_uploaded_activity_review(uuid,uuid,text) to service_role;

-- One shared queue source keeps calendar and dashboard totals consistent.
-- Existing assigned reviews retain their explicit request/reply lifecycle.
create function public.coaching_pending_review_items(p_actor_id uuid)
returns table(id uuid,athlete_id uuid,name text,workout_date date,title text,status text,
  completed_duration_min numeric,completed_distance_km numeric,athlete_rpe integer,
  request_open boolean,source_kind text,review_revision text,needs_review boolean)
language sql stable security invoker set search_path='' as $$
  select w.id,w.athlete_id,a.name,w.workout_date,w.title,w.status,
    w.completed_duration_min,w.completed_distance_km,w.athlete_rpe,
    w.response_requested and coalesce(r.resolved_revision<w.completion_revision,true),
    'workout'::text,null::text,w.status='completed' and coalesce(r.reviewed_revision<w.completion_revision,true)
  from public.planned_workouts w join public.coach_profiles c on c.id=w.coach_id and c.athlete_id=p_actor_id
  join public.athletes a on a.id=w.athlete_id
  left join public.workout_coach_reviews r on r.workout_id=w.id and r.coach_id=c.id
  where w.visibility='athlete_visible' and exists(select 1 from public.coach_athlete_relationships cr
    where cr.coach_id=c.id and cr.athlete_id=w.athlete_id and cr.status='active' and cr.removed_at is null and (cr.expires_at is null or cr.expires_at>now()))
    and ((w.status='completed' and coalesce(r.reviewed_revision<w.completion_revision,true))
      or (w.response_requested and coalesce(r.resolved_revision<w.completion_revision,true)))
  union all
  select a.id,a.athlete_id,ath.name,coalesce(a.local_date,a.start_date_local::date,(a.start_date at time zone 'UTC')::date),
    coalesce(nullif(a.name,''),'Uploaded workout'),'completed'::text,
    round(a.moving_time::numeric/60,1),round(a.distance/1000,2),null::integer,false,'activity'::text,
    public.uploaded_workout_review_revision(a),true
  from public.strava_activities a join public.athletes ath on ath.id=a.athlete_id
  join public.coach_profiles c on c.athlete_id=p_actor_id
  left join public.uploaded_workout_coach_reviews r on r.activity_id=a.id and r.coach_id=c.id
  where exists(select 1 from public.coach_athlete_relationships cr
    where cr.coach_id=c.id and cr.athlete_id=a.athlete_id and cr.status='active' and cr.removed_at is null and (cr.expires_at is null or cr.expires_at>now()))
    and (r.reviewed_revision is null or r.reviewed_revision<>public.uploaded_workout_review_revision(a))
    -- A visible completed plan assigned by this coach already owns this review.
    -- Private plans/other coaches' plans never conceal a readable recording.
    and not exists(select 1 from public.planned_workouts w where w.athlete_id=a.athlete_id and w.coach_id=c.id
      and w.visibility='athlete_visible' and w.status='completed' and w.completed_activity_id=a.id::text);
$$;
revoke all on function public.coaching_pending_review_items(uuid) from public,anon,authenticated;
grant execute on function public.coaching_pending_review_items(uuid) to service_role;

create or replace function public.coaching_review_queue(p_actor_id uuid,p_offset integer default 0)
returns jsonb language sql security invoker set search_path='' as $$
  with items as (select * from public.coaching_pending_review_items(p_actor_id)
    order by request_open desc,workout_date nulls last,source_kind,id limit 51 offset greatest(p_offset,0))
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.request_open desc,i.workout_date nulls last,i.source_kind,i.id)
    from (select * from items order by request_open desc,workout_date nulls last,source_kind,id limit 50)i),'[]'),
    'has_more',(select count(*)>50 from items));
$$;
create or replace function public.coaching_review_counts(p_actor_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.athlete_id),'[]') from (
    select athlete_id,count(*) filter(where needs_review) as pending_reviews,
      count(*) filter(where request_open) as response_requests
    from public.coaching_pending_review_items(p_actor_id) group by athlete_id
  ) c;
$$;
revoke all on function public.coaching_review_queue(uuid,integer),public.coaching_review_counts(uuid) from public,anon,authenticated;
grant execute on function public.coaching_review_queue(uuid,integer),public.coaching_review_counts(uuid) to service_role;
commit;
