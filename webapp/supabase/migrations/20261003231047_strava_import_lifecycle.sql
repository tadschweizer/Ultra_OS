-- Requires 20260725000000_activity_sync_persistence.sql.
-- Service-role only: lease, import, disconnect and provider-event changes are atomic.
create schema if not exists strava_private;
revoke all on schema strava_private from public, anon, authenticated;
grant usage on schema strava_private to service_role;
create table if not exists strava_private.sync_state (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  lease_token uuid, lease_until timestamptz, last_attempt_at timestamptz,
  retry_at timestamptz, dirty boolean not null default false,
  pending_activity_ids text[] not null default '{}', claimed_activity_id text
);
alter table strava_private.sync_state add column if not exists pending_activity_ids text[] not null default '{}';
alter table strava_private.sync_state add column if not exists claimed_activity_id text;
alter table strava_private.sync_state enable row level security;
revoke all on strava_private.sync_state from public, anon, authenticated;
grant select, insert, update, delete on strava_private.sync_state to service_role;

create or replace function public.claim_strava_sync(p_athlete_id uuid, p_strava_id text, p_force boolean default false, p_history boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.athletes; s strava_private.sync_state; token uuid;
begin
  select * into a from public.athletes where id=p_athlete_id for update;
  if not found or a.strava_id is distinct from p_strava_id or a.strava_id is null then return '{"reason":"not_connected"}'::jsonb; end if;
  insert into strava_private.sync_state(athlete_id) values(p_athlete_id) on conflict do nothing;
  select * into s from strava_private.sync_state where athlete_id=p_athlete_id for update;
  if s.lease_until>now() then return '{"reason":"in_progress"}'::jsonb; end if;
  if s.retry_at>now() then return jsonb_build_object('reason','retry_later','retry_at',s.retry_at); end if;
  if p_force and s.last_attempt_at>now()-interval '30 seconds' then return '{"reason":"throttled"}'::jsonb; end if;
  if not p_force and not p_history and not s.dirty and a.activity_backfill_completed_at is not null
     and a.last_activity_sync_at>now()-interval '10 minutes' then return '{"reason":"throttled"}'::jsonb; end if;
  token=gen_random_uuid();
  update strava_private.sync_state set lease_token=token,lease_until=now()+interval '5 minutes',last_attempt_at=now(),
    claimed_activity_id=s.pending_activity_ids[1] where athlete_id=p_athlete_id;
  return jsonb_build_object('lease_token',token,'activity_id',s.pending_activity_ids[1]);
end;
$$;

create or replace function public.finish_strava_sync(p_athlete_id uuid,p_strava_id text,p_lease_token uuid,p_rows jsonb,p_backfilled boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.athletes; s strava_private.sync_state; imported integer;
begin
  select * into a from public.athletes where id=p_athlete_id for update;
  select * into s from strava_private.sync_state where athlete_id=p_athlete_id for update;
  if a.id is null or a.strava_id is distinct from p_strava_id or p_lease_token is null
     or s.lease_token is distinct from p_lease_token or s.lease_until is null or s.lease_until<=now() then
    raise exception 'Strava connection or import lease changed' using errcode='22023';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Invalid import batch'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where r->>'athlete_id' is distinct from p_athlete_id::text
    or coalesce(r->>'strava_activity_id','')!~'^[0-9]+$' or r->>'start_date' is null) then raise exception 'Invalid import owner or activity'; end if;
  insert into public.strava_activities(athlete_id,strava_activity_id,name,sport_type,activity_type,start_date,start_date_local,local_date,utc_offset,timezone,distance,moving_time,elapsed_time,total_elevation_gain,elev_high,elev_low,average_speed,max_speed,average_heartrate,max_heartrate,average_cadence,has_heartrate,kilojoules,calories,suffer_score,workout_type,description,trainer,commute,manual,tss,intensity_factor,raw_payload,source,synced_at,updated_at)
  select p_athlete_id,r.strava_activity_id,r.name,r.sport_type,r.activity_type,r.start_date,r.start_date_local,r.local_date,r.utc_offset,r.timezone,r.distance,r.moving_time,r.elapsed_time,r.total_elevation_gain,r.elev_high,r.elev_low,r.average_speed,r.max_speed,r.average_heartrate,r.max_heartrate,r.average_cadence,r.has_heartrate,r.kilojoules,r.calories,r.suffer_score,r.workout_type,r.description,r.trainer,r.commute,r.manual,r.tss,r.intensity_factor,r.raw_payload,'strava',now(),now()
    from jsonb_populate_recordset(null::public.strava_activities,p_rows) r
  on conflict(athlete_id,strava_activity_id) do update set name=excluded.name,sport_type=excluded.sport_type,activity_type=excluded.activity_type,start_date=excluded.start_date,start_date_local=excluded.start_date_local,local_date=excluded.local_date,utc_offset=excluded.utc_offset,timezone=excluded.timezone,distance=excluded.distance,moving_time=excluded.moving_time,elapsed_time=excluded.elapsed_time,total_elevation_gain=excluded.total_elevation_gain,elev_high=excluded.elev_high,elev_low=excluded.elev_low,average_speed=excluded.average_speed,max_speed=excluded.max_speed,average_heartrate=excluded.average_heartrate,max_heartrate=excluded.max_heartrate,average_cadence=excluded.average_cadence,has_heartrate=excluded.has_heartrate,kilojoules=excluded.kilojoules,calories=excluded.calories,suffer_score=excluded.suffer_score,workout_type=excluded.workout_type,description=excluded.description,trainer=excluded.trainer,commute=excluded.commute,manual=excluded.manual,tss=excluded.tss,intensity_factor=excluded.intensity_factor,raw_payload=excluded.raw_payload,synced_at=now(),updated_at=now();
  get diagnostics imported=row_count;
  update public.athletes set last_activity_sync_at=now(),last_activity_sync_error=null,
    activity_backfill_completed_at=case when p_backfilled then now() else activity_backfill_completed_at end where id=p_athlete_id;
  update strava_private.sync_state set lease_token=null,lease_until=null,retry_at=null,
    pending_activity_ids=array_remove(pending_activity_ids,s.claimed_activity_id),claimed_activity_id=null,
    dirty=cardinality(array_remove(pending_activity_ids,s.claimed_activity_id))>0 where athlete_id=p_athlete_id;
  return jsonb_build_object('synced',imported);
end;
$$;

create or replace function public.release_strava_sync(p_athlete_id uuid,p_lease_token uuid,p_error text,p_retry_seconds integer default 30)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- Same lock order as finish/disconnect; a stale worker cannot mark a new connection failed.
  perform 1 from public.athletes where id=p_athlete_id for update;
  update strava_private.sync_state set lease_token=null,lease_until=null,
    retry_at=now()+make_interval(secs=>greatest(0,least(p_retry_seconds,86400)))
    where athlete_id=p_athlete_id and lease_token=p_lease_token;
  if found then update public.athletes set last_activity_sync_error=left(p_error,100) where id=p_athlete_id; end if;
end;
$$;

create or replace function public.disconnect_strava(p_athlete_id uuid,p_strava_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.athletes; removed integer;
begin
  select * into a from public.athletes where id=p_athlete_id for update;
  if found and a.strava_id is null then return '{"removed":0}'::jsonb; end if;
  if not found or a.strava_id is distinct from p_strava_id then raise exception 'Strava connection changed' using errcode='22023'; end if;
  delete from public.strava_activities where athlete_id=p_athlete_id;
  get diagnostics removed=row_count;
  update public.athletes set strava_id=null,access_token=null,refresh_token=null,token_expires_at=null,
    last_activity_sync_at=null,last_activity_sync_error=null,activity_backfill_completed_at=null where id=p_athlete_id;
  delete from strava_private.sync_state where athlete_id=p_athlete_id;
  return jsonb_build_object('removed',removed);
end;
$$;

create or replace function public.handle_strava_event(p_owner_id text,p_activity_id text,p_action text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner uuid; removed integer=0;
begin
  if p_action not in ('refresh','delete','deauthorize') then raise exception 'Invalid Strava action'; end if;
  select id into owner from public.athletes where strava_id=p_owner_id for update;
  if owner is null then return '{"ignored":true}'::jsonb; end if;
  if p_action='deauthorize' then return public.disconnect_strava(owner,p_owner_id); end if;
  -- Invalidate any in-flight import: it must not recreate a deleted/private activity.
  if coalesce(p_activity_id,'')!~'^[0-9]+$' then raise exception 'Invalid Strava activity'; end if;
  insert into strava_private.sync_state(athlete_id,dirty,pending_activity_ids)
    values(owner,true,case when p_action='refresh' then array[p_activity_id] else '{}'::text[] end)
    on conflict(athlete_id) do update set dirty=true,lease_token=null,lease_until=null,claimed_activity_id=null,
      pending_activity_ids=case when p_action='delete' then array_remove(strava_private.sync_state.pending_activity_ids,p_activity_id)
        when p_activity_id=any(strava_private.sync_state.pending_activity_ids) then strava_private.sync_state.pending_activity_ids
        else array_append(strava_private.sync_state.pending_activity_ids,p_activity_id) end;
  if p_action='delete' then
    delete from public.strava_activities where athlete_id=owner and strava_activity_id=p_activity_id;
    get diagnostics removed=row_count;
  end if;
  return jsonb_build_object('removed',removed,'refresh_pending',true);
end;
$$;

revoke all on function public.claim_strava_sync(uuid,text,boolean,boolean),public.finish_strava_sync(uuid,text,uuid,jsonb,boolean),
  public.release_strava_sync(uuid,uuid,text,integer),public.disconnect_strava(uuid,text),public.handle_strava_event(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_strava_sync(uuid,text,boolean,boolean),public.finish_strava_sync(uuid,text,uuid,jsonb,boolean),
  public.release_strava_sync(uuid,uuid,text,integer),public.disconnect_strava(uuid,text),public.handle_strava_event(text,text,text) to service_role;
create or replace function public.pending_strava_sync()
returns uuid language sql security invoker set search_path = '' as $$
  select a.id from public.athletes a left join strava_private.sync_state s on s.athlete_id=a.id
  where a.strava_id is not null and a.access_token is not null
    and (s.lease_until is null or s.lease_until<=now()) and (s.retry_at is null or s.retry_at<=now())
    and (coalesce(s.dirty,false) or a.activity_backfill_completed_at is null or a.last_activity_sync_at is null
      or a.last_activity_sync_at<now()-interval '10 minutes')
  order by coalesce(s.dirty,false) desc,a.last_activity_sync_at nulls first,a.id limit 1;
$$;
revoke all on function public.pending_strava_sync() from public,anon,authenticated;
grant execute on function public.pending_strava_sync() to service_role;
notify pgrst,'reload schema';
