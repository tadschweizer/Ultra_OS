-- Service-role entry points still enforce actor ownership and active relationships.
-- Prerequisites: coach_messages, workout_comments and coach_notifications.
create table public.message_preferences (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  email_enabled boolean not null default false,
  badge_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.message_drafts (
  owner_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  sender_role text not null check (sender_role in ('coach','athlete')),
  body text not null check (char_length(body) <= 5000),
  template_key text,
  client_message_id uuid,
  version uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, coach_id, athlete_id, sender_role)
);
create table public.message_email_deliveries (
  message_id uuid primary key references public.coach_messages(id) on delete cascade,
  recipient_id uuid not null references public.athletes(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('coach','athlete')),
  status text not null default 'pending' check (status in ('pending','processing','sent','skipped','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '23 hours'),
  lease_token uuid,
  provider_id text,
  failure_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index message_email_pending on public.message_email_deliveries(available_at, created_at)
  where status in ('pending','processing');
create index message_email_recipient on public.message_email_deliveries(recipient_id, created_at desc);
create index message_unread_direct on public.coach_messages(coach_id, athlete_id, sender_role) where read_at is null;
create index message_unread_comments on public.workout_comments(athlete_id, sender_role) where read_at is null;
create index message_comment_subject on public.workout_comments(athlete_id, planned_workout_id, activity_id, created_at desc);
alter table public.message_preferences enable row level security;
alter table public.message_drafts enable row level security;
alter table public.message_email_deliveries enable row level security;
revoke all on public.message_preferences, public.message_drafts, public.message_email_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.message_preferences, public.message_drafts, public.message_email_deliveries to service_role;

create function public.authorize_message_conversation(p_owner uuid, p_coach uuid, p_athlete uuid, p_role text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_role not in ('coach','athlete') or p_role is null or p_owner is null
    or (p_role='athlete' and p_owner <> p_athlete)
    or (p_role='coach' and not exists(select 1 from public.coach_profiles where id=p_coach and athlete_id=p_owner)) then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  perform 1 from public.coach_athlete_relationships where coach_id=p_coach and athlete_id=p_athlete and status='active' for share;
  if not found then raise exception 'No active relationship' using errcode='42501'; end if;
end $$;

create function public.save_message_draft(p_owner uuid, p_coach uuid, p_athlete uuid, p_role text,
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
    raise exception 'Draft changed in another session' using errcode='40001';
  end if;
  insert into public.message_drafts(owner_id,coach_id,athlete_id,sender_role,body,template_key,client_message_id)
    values(p_owner,p_coach,p_athlete,p_role,p_body,p_template,p_client_id)
    on conflict(owner_id,coach_id,athlete_id,sender_role) do update set body=excluded.body,template_key=excluded.template_key,
      client_message_id=excluded.client_message_id,version=gen_random_uuid(),updated_at=now() returning * into saved;
  return to_jsonb(saved);
end $$;

create function public.send_direct_message(p_owner uuid, p_coach uuid, p_athlete uuid, p_role text,
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
      raise exception 'Retry does not match original message' using errcode='40001';
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

create function public.message_inbox_summary(p_owner uuid, p_role text)
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
  select count(*) into comment_count from public.workout_comments where athlete_id=any(ids) and sender_role<>p_role and read_at is null;
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
      from public.workout_comments where athlete_id=any(ids) group by athlete_id,planned_workout_id,activity_id
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

create function public.claim_message_email()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare job public.message_email_deliveries; msg public.coach_messages; recipient public.athletes; enabled boolean; token uuid; why text;
begin
  select * into job from public.message_email_deliveries where status in ('pending','processing') and available_at<=now()
    order by available_at,created_at for update skip locked limit 1;
  if job.message_id is null then return null; end if;
  select * into msg from public.coach_messages where id=job.message_id;
  select * into recipient from public.athletes where id=job.recipient_id;
  select email_enabled into enabled from public.message_preferences where athlete_id=job.recipient_id;
  why := case when job.expires_at<=now() then 'expired' when job.attempts>=5 then 'attempt_limit'
    when not coalesce(enabled,false) then 'disabled' when msg.read_at is not null then 'already_read'
    when recipient.email is null or recipient.email_verified_at is null then 'unverified_email'
    when not exists(select 1 from public.coach_athlete_relationships where coach_id=msg.coach_id and athlete_id=msg.athlete_id and status='active') then 'relationship_revoked'
    when job.recipient_role='coach' and not exists(select 1 from public.coach_profiles where id=msg.coach_id and athlete_id=job.recipient_id) then 'recipient_changed'
    else null end;
  if why is not null then
    update public.message_email_deliveries set status='skipped',failure_category=why,lease_token=null,updated_at=now() where message_id=job.message_id;
    return jsonb_build_object('skipped',true);
  end if;
  token := gen_random_uuid();
  update public.message_email_deliveries set status='processing',attempts=attempts+1,available_at=now()+interval '2 minutes',lease_token=token,updated_at=now() where message_id=job.message_id;
  return jsonb_build_object('message_id',job.message_id,'lease_token',token,'email',recipient.email,
    'mode',job.recipient_role,'athlete_id',msg.athlete_id);
end $$;

create function public.finish_message_email(p_message uuid,p_lease uuid,p_outcome text,p_provider text,p_failure text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_outcome is null or p_outcome not in ('sent','retry','failed') or p_failure not in ('provider_unavailable','provider_rejected','unconfigured') and p_failure is not null then
    raise exception 'Invalid outcome' using errcode='22023';
  end if;
  update public.message_email_deliveries set status=case when p_outcome='retry' and attempts<5 and expires_at>now() then 'pending' when p_outcome='retry' then 'failed' else p_outcome end,
    available_at=now()+interval '1 minute'*power(2,attempts),lease_token=null,provider_id=p_provider,failure_category=p_failure,updated_at=now()
    where message_id=p_message and lease_token=p_lease and status='processing';
  return found;
end $$;

-- Do not expose actor-parameter RPCs through the client Data API.
revoke all on function public.authorize_message_conversation(uuid,uuid,uuid,text),public.save_message_draft(uuid,uuid,uuid,text,text,text,uuid,uuid),
  public.send_direct_message(uuid,uuid,uuid,text,text,text,uuid),public.message_inbox_summary(uuid,text),public.claim_message_email(),
  public.finish_message_email(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.authorize_message_conversation(uuid,uuid,uuid,text),public.save_message_draft(uuid,uuid,uuid,text,text,text,uuid,uuid),
  public.send_direct_message(uuid,uuid,uuid,text,text,text,uuid),public.message_inbox_summary(uuid,text),public.claim_message_email(),
  public.finish_message_email(uuid,uuid,text,text,text) to service_role;
