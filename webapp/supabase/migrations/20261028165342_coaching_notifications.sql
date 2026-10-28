-- Prepared locally. Production application requires owner authorization.
begin;
set local lock_timeout = '5s';

create table public.coaching_notification_settings (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  preferences jsonb not null default '{}',
  phone text,
  phone_verified_at timestamptz,
  sms_consent_at timestamptz,
  sms_stopped_at timestamptz,
  updated_at timestamptz not null default now(),
  check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);
create table public.coaching_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.athletes(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  event text not null check (event in ('workout_completed','workout_comment','workout_assigned')),
  source_table text not null check (source_table in ('planned_workouts','strava_activities','workout_comments')),
  source_id uuid not null,
  channel text not null check (channel in ('email','sms')),
  status text not null default 'pending' check (status in ('pending','processing','accepted','skipped','failed','uncertain')),
  attempts integer not null default 0,
  lease_token uuid,
  provider_id text,
  failure_category text,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '20 hours',
  unique(recipient_id,event,source_table,source_id,channel)
);
create index coaching_delivery_pending on public.coaching_notification_deliveries(available_at) where status in ('pending','processing');
create index coaching_settings_phone on public.coaching_notification_settings(phone) where phone is not null;
alter table public.coaching_notification_settings enable row level security;
alter table public.coaching_notification_deliveries enable row level security;
revoke all on public.coaching_notification_settings, public.coaching_notification_deliveries from public, anon, authenticated;
grant select,insert,update,delete on public.coaching_notification_settings, public.coaching_notification_deliveries to service_role;

create function public.queue_coaching_notification(p_recipient uuid,p_athlete uuid,p_coach uuid,p_event text,p_table text,p_source uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.coach_athlete_relationships where coach_id=p_coach and athlete_id=p_athlete and status='active'
    and removed_at is null and (expires_at is null or expires_at>now())) then return; end if;
  insert into public.coaching_notification_deliveries(recipient_id,athlete_id,coach_id,event,source_table,source_id,channel)
  select p_recipient,p_athlete,p_coach,p_event,p_table,p_source,c.channel
  from public.coaching_notification_settings s cross join (values('email'),('sms')) c(channel)
  where s.athlete_id=p_recipient and s.preferences->(p_event||'_'||c.channel)='true'::jsonb
    and (c.channel='email' or (s.phone_verified_at is not null and s.sms_consent_at is not null and s.sms_stopped_at is null))
  on conflict do nothing;
end $$;

create function public.capture_coaching_notification() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r record; target_coach uuid; target_athlete uuid; coach_owner uuid; w public.planned_workouts;
begin
  if tg_table_name='strava_activities' then
    -- Ignore initial historical sync; later upserts never send another alert.
    if new.start_date is null or new.start_date < now()-interval '48 hours' then return new; end if;
    for r in select cp.id,cp.athlete_id from public.coach_profiles cp join public.coach_athlete_relationships cr on cr.coach_id=cp.id
      where cr.athlete_id=new.athlete_id and cr.status='active' and cp.athlete_id<>new.athlete_id loop
      perform public.queue_coaching_notification(r.athlete_id,new.athlete_id,r.id,'workout_completed',tg_table_name,new.id);
    end loop;
  elsif tg_table_name='planned_workouts' then
    if new.visibility<>'athlete_visible' then return new; end if;
    if new.coach_id is not null then
      select athlete_id into coach_owner from public.coach_profiles where id=new.coach_id;
      if coach_owner<>new.athlete_id and new.status='planned' and new.workout_date>=current_date and
        (tg_op='INSERT' or old.visibility='coach_private') then
        perform public.queue_coaching_notification(new.athlete_id,new.athlete_id,new.coach_id,'workout_assigned',tg_table_name,new.id);
      end if;
    end if;
    -- Linked imported sessions already notify from the activity insert.
    if new.status='completed' and new.completed_activity_id is null and (tg_op='INSERT' or old.status<>'completed') then
      for r in select cp.id,cp.athlete_id from public.coach_profiles cp join public.coach_athlete_relationships cr on cr.coach_id=cp.id
        where cr.athlete_id=new.athlete_id and cr.status='active' and cp.athlete_id<>new.athlete_id loop
        perform public.queue_coaching_notification(r.athlete_id,new.athlete_id,r.id,'workout_completed',tg_table_name,new.id);
      end loop;
    end if;
  else
    target_athlete:=new.athlete_id; target_coach:=new.coach_id;
    if new.planned_workout_id is not null then
      select * into w from public.planned_workouts where id=new.planned_workout_id;
      if not found or w.visibility<>'athlete_visible' then return new; end if;
    end if;
    select athlete_id into coach_owner from public.coach_profiles where id=target_coach;
    if coach_owner is null or coach_owner=target_athlete then return new; end if;
    perform public.queue_coaching_notification(case when new.sender_role='coach' then target_athlete else coach_owner end,
      target_athlete,target_coach,'workout_comment',tg_table_name,new.id);
  end if;
  return new;
end $$;
create trigger coaching_activity_notification after insert on public.strava_activities for each row execute function public.capture_coaching_notification();
create trigger coaching_plan_notification after insert or update on public.planned_workouts for each row execute function public.capture_coaching_notification();
create trigger coaching_comment_notification after insert on public.workout_comments for each row execute function public.capture_coaching_notification();

create function public.claim_coaching_notification(p_channel text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.coaching_notification_deliveries; s public.coaching_notification_settings; a public.athletes; valid_source boolean; token uuid;
begin
  select * into j from public.coaching_notification_deliveries where channel=p_channel and status in ('pending','processing') and available_at<=now()
    order by available_at,id for update skip locked limit 1;
  if not found then return null; end if;
  -- SMS POST has no idempotency contract: do not repeat after a crashed worker.
  if j.status='processing' and j.channel='sms' then
    update public.coaching_notification_deliveries set status='uncertain',lease_token=null,failure_category='worker_interrupted' where id=j.id;
    return jsonb_build_object('skipped',true);
  end if;
  select * into s from public.coaching_notification_settings where athlete_id=j.recipient_id;
  select * into a from public.athletes where id=j.recipient_id;
  valid_source:=false;
  if j.source_table='strava_activities' then
    valid_source:=exists(select 1 from public.strava_activities where id=j.source_id and athlete_id=j.athlete_id);
  elsif j.source_table='planned_workouts' then
    valid_source:=exists(select 1 from public.planned_workouts where id=j.source_id and athlete_id=j.athlete_id and visibility='athlete_visible'
      and ((j.event='workout_completed' and status='completed') or (j.event='workout_assigned' and coach_id=j.coach_id)));
  else
    valid_source:=exists(select 1 from public.workout_comments c left join public.planned_workouts w on w.id=c.planned_workout_id
      where c.id=j.source_id and c.athlete_id=j.athlete_id and c.coach_id=j.coach_id
      and (c.planned_workout_id is null or w.visibility='athlete_visible'));
  end if;
  if j.expires_at<=now() or j.attempts>=5 or not valid_source
    or not coalesce(s.preferences->(j.event||'_'||j.channel)='true'::jsonb,false)
    or not exists(select 1 from public.coach_athlete_relationships where coach_id=j.coach_id and athlete_id=j.athlete_id and status='active'
      and removed_at is null and (expires_at is null or expires_at>now()))
    or (j.channel='email' and (a.email is null or a.email_verified_at is null))
    or (j.channel='sms' and (s.phone is null or s.phone_verified_at is null or s.sms_consent_at is null or s.sms_stopped_at is not null)) then
    update public.coaching_notification_deliveries set status='skipped',lease_token=null,failure_category='no_longer_eligible' where id=j.id;
    return jsonb_build_object('skipped',true);
  end if;
  token:=gen_random_uuid();
  update public.coaching_notification_deliveries set status='processing',attempts=attempts+1,lease_token=token,available_at=now()+interval '2 minutes' where id=j.id;
  return jsonb_build_object('id',j.id,'lease_token',token,'event',j.event,'channel',j.channel,'email',a.email,'phone',s.phone,
    'athlete_id',j.athlete_id,'mode',case when j.recipient_id=j.athlete_id then 'athlete' else 'coach' end);
end $$;

create function public.finish_coaching_notification(p_id uuid,p_lease uuid,p_outcome text,p_provider text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if p_outcome not in ('accepted','failed','retry','uncertain') or p_outcome is null then raise exception 'Invalid outcome'; end if;
  update public.coaching_notification_deliveries set status=case when p_outcome='retry' and attempts<5 and expires_at>now() then 'pending'
      when p_outcome='retry' then 'failed' else p_outcome end,
    provider_id=p_provider,lease_token=null,available_at=now()+interval '5 minutes'
    where id=p_id and lease_token=p_lease and status='processing' and available_at>now();
  return found;
end $$;

revoke all on function public.queue_coaching_notification(uuid,uuid,uuid,text,text,uuid),public.capture_coaching_notification(),
  public.claim_coaching_notification(text),public.finish_coaching_notification(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.queue_coaching_notification(uuid,uuid,uuid,text,text,uuid),public.capture_coaching_notification(),
  public.claim_coaching_notification(text),public.finish_coaching_notification(uuid,uuid,text,text) to service_role;
create function public.save_coaching_notification_preferences(p_owner uuid,p_patch jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved jsonb;
begin
  insert into public.coaching_notification_settings(athlete_id,preferences) values(p_owner,p_patch)
  on conflict(athlete_id) do update set preferences=public.coaching_notification_settings.preferences||excluded.preferences,updated_at=now()
  returning preferences into saved;
  return saved;
end $$;
revoke all on function public.save_coaching_notification_preferences(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_coaching_notification_preferences(uuid,jsonb) to service_role;
commit;
