-- Prevent private titles/comments/counts entering inbox previews. Filter before
-- aggregation and pagination; existing service-only function grants remain.
begin;
set local lock_timeout = '5s';
create or replace function public.message_inbox_summary(p_owner uuid, p_role text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare coach uuid; ids uuid[]; conv jsonb; threads jsonb; direct_count bigint; comment_count bigint; badge boolean;
begin
  if not exists(select 1 from public.athletes where id=p_owner) or p_role not in ('coach','athlete') or p_role is null then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  if p_role='coach' then
    select id into coach from public.coach_profiles where athlete_id=p_owner;
    if coach is null then raise exception 'Coach access required' using errcode='42501'; end if;
    select array_agg(athlete_id) into ids from public.coach_athlete_relationships where coach_id=coach and status='active';
  else
    select coach_id into coach from public.coach_athlete_relationships where athlete_id=p_owner and status='active' order by created_at,id limit 1;
    ids := case when coach is null then array[]::uuid[] else array[p_owner] end;
  end if;
  ids := coalesce(ids,array[]::uuid[]);
  select count(*) into direct_count from public.coach_messages where coach_id=coach and athlete_id=any(ids)
    and sender_role<>p_role and read_at is null;
  select count(*) into comment_count from public.workout_comments where athlete_id=any(ids) and sender_role<>p_role and read_at is null and (planned_workout_id is null or exists (
      select 1 from public.planned_workouts private_subject
      where private_subject.id=planned_workout_id and private_subject.athlete_id=public.workout_comments.athlete_id
        and (private_subject.visibility='athlete_visible' or (p_role='coach' and private_subject.coach_id=coach))
    ));
  select coalesce(jsonb_agg(item order by last_at desc nulls last, aid), '[]'::jsonb) into conv from (
    select a.id aid, latest.created_at last_at, jsonb_build_object('athlete_id',a.id,'coach_id',coach,
      'name',case when p_role='coach' then coalesce(a.name,a.email,'Athlete') else coalesce(cp.display_name,'Coach') end,
      'athlete',jsonb_build_object('id',a.id,'name',case when p_role='coach' then coalesce(a.name,a.email,'Athlete') else coalesce(cp.display_name,'Coach') end),
      'group_name',r.group_name,'last_message',to_jsonb(latest),
      'unread',unread.n,'unread_count',unread.n) item
    from public.athletes a join public.coach_athlete_relationships r on r.athlete_id=a.id and r.coach_id=coach and r.status='active'
    join public.coach_profiles cp on cp.id=coach
    left join lateral (select m.* from public.coach_messages m where m.coach_id=coach and m.athlete_id=a.id order by m.created_at desc,m.id desc limit 1) latest on true
    cross join lateral (select count(*) n from public.coach_messages m where m.coach_id=coach and m.athlete_id=a.id and m.sender_role<>p_role and m.read_at is null) unread
    where a.id=any(ids)
  ) q;
  select coalesce(jsonb_agg(item order by unread desc,last_at desc), '[]'::jsonb) into threads from (
    select t.unread,t.last_at,jsonb_build_object('subject_type',case when t.planned_workout_id is null then 'activity' else 'workout' end,
      'subject_id',coalesce(t.planned_workout_id::text,t.activity_id::text),'athlete_id',t.athlete_id,
      'name',case when p_role='coach' then coalesce(a.name,a.email,'Athlete') else 'Coach' end,
      'title',coalesce(w.title,s.name,'Workout'),'date',coalesce(w.workout_date::text,s.local_date::text),
      'sport',coalesce(w.sport,s.sport_type,'other'),'last_comment',to_jsonb(latest),'unread',t.unread) item
    from (select athlete_id,planned_workout_id,activity_id,count(*) filter(where sender_role<>p_role and read_at is null) unread,max(created_at) last_at
      from public.workout_comments where athlete_id=any(ids) and (planned_workout_id is null or exists (
      select 1 from public.planned_workouts private_subject
      where private_subject.id=planned_workout_id and private_subject.athlete_id=public.workout_comments.athlete_id
        and (private_subject.visibility='athlete_visible' or (p_role='coach' and private_subject.coach_id=coach))
    )) group by athlete_id,planned_workout_id,activity_id
      order by unread desc,last_at desc limit 60) t
    join public.athletes a on a.id=t.athlete_id
    left join public.planned_workouts w on w.id=t.planned_workout_id and w.athlete_id=t.athlete_id
    left join public.strava_activities s on s.id=t.activity_id and s.athlete_id=t.athlete_id
    left join lateral(select c.* from public.workout_comments c where c.athlete_id=t.athlete_id
      and c.planned_workout_id is not distinct from t.planned_workout_id and c.activity_id is not distinct from t.activity_id
      order by c.created_at desc,c.id desc limit 1) latest on true
  ) q;
  select badge_enabled into badge from public.message_preferences where athlete_id=p_owner;
  return jsonb_build_object('conversations',conv,'workout_threads',threads,'direct_unread_total',direct_count,
    'unread_total',direct_count+comment_count,'has_coach',coach is not null,'has_messaging',cardinality(ids)>0,
    'badge_enabled',coalesce(badge,true));
end $$;

commit;
