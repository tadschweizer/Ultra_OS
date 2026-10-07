-- Narrow messaging prerequisite repair: production may lack coach_messages.
-- Does not replay the older groups/shared-document migrations.
begin;
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  sender_role text not null check (sender_role in ('coach','athlete')),
  message_body text not null,
  message_template_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.athletes add column if not exists notification_preferences jsonb not null default '{}'::jsonb;
alter table public.coach_messages enable row level security;
revoke all on public.coach_messages from public, anon, authenticated;
grant select, insert, update, delete on public.coach_messages to service_role;
create index if not exists idx_messages_history on public.coach_messages(coach_id, athlete_id, created_at desc, id desc);
create index if not exists idx_messages_unread on public.coach_messages(coach_id, athlete_id, sender_role) where read_at is null;
create index if not exists idx_comments_unread on public.workout_comments(athlete_id, coach_id, sender_role) where read_at is null;

create table public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid references public.coach_profiles(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  source_kind text not null check (source_kind in ('direct','comment','legacy')),
  source_id uuid not null,
  notification_type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id text,
  delivery_state text not null check (delivery_state in ('delivered','suppressed')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_id, source_kind, source_id)
);
alter table public.account_notifications enable row level security;
revoke all on public.account_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.account_notifications to service_role;
create index idx_account_notifications_feed on public.account_notifications(recipient_id, created_at desc, id desc) where delivery_state = 'delivered';
create index idx_account_notifications_unread on public.account_notifications(recipient_id) where delivery_state = 'delivered' and read_at is null;

-- Serialize sends with relationship revocation, including the small gap
-- between a route's authorization query and its actual insert/retry.
create function public.require_message_relationship() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.coach_athlete_relationships r
  where r.coach_id=new.coach_id and r.athlete_id=new.athlete_id and r.status='active' for share;
  if not found then raise exception 'Active coaching relationship required' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function public.require_message_relationship() from public,anon,authenticated;
grant execute on function public.require_message_relationship() to service_role;
create trigger require_message_relationship before insert on public.coach_messages
for each row execute function public.require_message_relationship();

-- Preserve existing coach alerts and read timestamps; redact old message previews.
insert into public.account_notifications(id,recipient_id,coach_id,athlete_id,source_kind,source_id,notification_type,title,body,entity_type,entity_id,delivery_state,read_at,created_at)
select n.id,p.athlete_id,n.coach_id,n.athlete_id,'legacy',n.id,n.notification_type,n.title,
  case when n.notification_type in ('athlete_message','workout_comment') then 'Open the conversation to read the reply.' else n.body end,
  n.entity_type,n.entity_id::text,'delivered',n.read_at,n.created_at
from public.coach_notifications n join public.coach_profiles p on p.id=n.coach_id
where p.athlete_id is not null;

-- In-app delivery is transactional: a message cannot commit without its delivery
-- record. Suppression is recorded at send time; re-enabling never floods old alerts.
create function public.deliver_message_notification() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare recipient uuid; preference text; kind text; entity text; entity_key text; enabled boolean;
begin
  kind := case when tg_table_name='coach_messages' then 'direct' else 'comment' end;
  if tg_op='DELETE' then
    delete from public.account_notifications where source_kind=kind and source_id=old.id;
    return old;
  end if;
  if tg_op='UPDATE' then
    if new.read_at is not null and old.read_at is null then
      update public.account_notifications set read_at=coalesce(read_at,new.read_at)
      where (source_kind=kind and source_id=new.id)
        or (kind='direct' and source_kind='legacy' and entity_type='coach_message' and entity_id=new.id::text);
    end if;
    return new;
  end if;
  if new.coach_id is null or not exists (
    select 1 from public.coach_athlete_relationships r
    where r.coach_id=new.coach_id and r.athlete_id=new.athlete_id and r.status='active'
  ) then return new; end if;
  if new.sender_role='coach' then recipient:=new.athlete_id;
  else select p.athlete_id into recipient from public.coach_profiles p where p.id=new.coach_id; end if;
  if recipient is null then return new; end if;
  if kind='direct' then
    preference:=case when new.sender_role='coach' then 'coach_message' else 'athlete_message' end;
    entity:='coach_message'; entity_key:=new.id::text;
  else
    preference:='workout_comment';
    entity:=case when new.planned_workout_id is null then 'activity' else 'planned_workout' end;
    entity_key:=coalesce(new.planned_workout_id,new.activity_id)::text;
  end if;
  select coalesce(a.notification_preferences->preference,'true'::jsonb) <> 'false'::jsonb into enabled
  from public.athletes a where a.id=recipient;
  insert into public.account_notifications(recipient_id,coach_id,athlete_id,source_kind,source_id,notification_type,title,body,entity_type,entity_id,delivery_state)
  values(recipient,new.coach_id,new.athlete_id,kind,new.id,preference,
    case when kind='comment' then 'New session comment' when new.sender_role='coach' then 'New coach message' else 'New athlete message' end,
    'Open the conversation to read the reply.',entity,entity_key,case when enabled then 'delivered' else 'suppressed' end)
  on conflict(recipient_id,source_kind,source_id) do nothing;
  return new;
end $$;
revoke all on function public.deliver_message_notification() from public,anon,authenticated;
grant execute on function public.deliver_message_notification() to service_role;
create trigger message_notification after insert or update of read_at or delete on public.coach_messages
for each row execute function public.deliver_message_notification();
create trigger comment_notification after insert or update of read_at or delete on public.workout_comments
for each row execute function public.deliver_message_notification();

-- Other existing coach alert writers keep working. Ignore their obsolete
-- message/comment side effects, which are now handled by the atomic triggers.
create function public.deliver_legacy_coach_notification() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare recipient uuid; enabled boolean;
begin
  if tg_op='UPDATE' then
    update public.account_notifications set read_at=coalesce(read_at,new.read_at) where source_kind='legacy' and source_id=new.id;
    return new;
  end if;
  if new.notification_type in ('athlete_message','workout_comment') then return new; end if;
  select p.athlete_id into recipient from public.coach_profiles p where p.id=new.coach_id;
  if recipient is null then return new; end if;
  select coalesce(a.notification_preferences->new.notification_type,'true'::jsonb)<>'false'::jsonb into enabled
  from public.athletes a where a.id=recipient;
  insert into public.account_notifications(id,recipient_id,coach_id,athlete_id,source_kind,source_id,notification_type,title,body,entity_type,entity_id,delivery_state,read_at,created_at)
  values(new.id,recipient,new.coach_id,new.athlete_id,'legacy',new.id,new.notification_type,new.title,new.body,new.entity_type,new.entity_id::text,
    case when enabled then 'delivered' else 'suppressed' end,new.read_at,new.created_at);
  return new;
end $$;
revoke all on function public.deliver_legacy_coach_notification() from public,anon,authenticated;
grant execute on function public.deliver_legacy_coach_notification() to service_role;
create trigger legacy_coach_notification after insert or update of read_at on public.coach_notifications
for each row execute function public.deliver_legacy_coach_notification();

-- One snapshot for both inboxes. Counts aggregate ALL rows; only the newest
-- message/comment is returned as a preview. Service-only; routes resolve actor.
create function public.messaging_summary(p_actor_id uuid,p_mode text) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare own_coach uuid; active_coach uuid; conversations jsonb; threads jsonb;
begin
  if p_mode not in ('athlete','coach') then raise exception 'Invalid mode'; end if;
  select id into own_coach from public.coach_profiles where athlete_id=p_actor_id;
  if p_mode='coach' and own_coach is null then raise exception 'Coach profile required'; end if;
  select coach_id into active_coach from public.coach_athlete_relationships
  where athlete_id=p_actor_id and status='active' order by coach_id limit 1;
  with parties as (
    select distinct r.coach_id,r.athlete_id,r.group_name
    from public.coach_athlete_relationships r where r.status='active'
      and ((p_mode='coach' and r.coach_id=own_coach) or (p_mode='athlete' and r.athlete_id=p_actor_id and r.coach_id=active_coach))
  ), previews as (
    select r.*,case when p_mode='coach' then coalesce(a.name,a.email,'Athlete') else coalesce(cp.display_name,'Coach') end as name,
      m.value as last_message,
      (select count(*) from public.coach_messages c where c.coach_id=r.coach_id and c.athlete_id=r.athlete_id
        and c.sender_role<>p_mode and c.read_at is null) as unread
    from parties r join public.athletes a on a.id=r.athlete_id join public.coach_profiles cp on cp.id=r.coach_id
    left join lateral (select to_jsonb(c) as value from public.coach_messages c where c.coach_id=r.coach_id and c.athlete_id=r.athlete_id
      order by c.created_at desc,c.id desc limit 1) m on true
  ) select coalesce(jsonb_agg(to_jsonb(previews) order by last_message->>'created_at' desc nulls last,athlete_id),'[]') into conversations from previews;
  with visible as (
    select c.* from public.workout_comments c
    where (p_mode='athlete' and c.athlete_id=p_actor_id and (c.coach_id=active_coach or c.coach_id is null))
      or (p_mode='coach' and (c.coach_id=own_coach or c.coach_id is null) and exists (
        select 1 from public.coach_athlete_relationships r where r.coach_id=own_coach and r.athlete_id=c.athlete_id and r.status='active'))
  ), grouped as (
    select athlete_id,planned_workout_id,activity_id,count(*) filter(where sender_role<>p_mode and read_at is null) as unread,
      (array_agg(id order by created_at desc,id desc))[1] as last_id
    from visible group by athlete_id,planned_workout_id,activity_id
  ), resolved as (
    select g.athlete_id,g.unread,case when g.activity_id is null then 'workout' else 'activity' end as subject_type,
      coalesce(g.planned_workout_id,g.activity_id)::text as subject_id,
      coalesce(w.title,s.name,'Session') as title,
      coalesce(w.workout_date::text,s.local_date::text,to_char(s.start_date at time zone 'UTC','YYYY-MM-DD')) as date,
      coalesce(w.sport,s.sport_type) as sport,
      case when p_mode='coach' then coalesce(a.name,a.email,'Athlete') else 'Coach' end as name,
      to_jsonb(c) as last_comment
    from grouped g join visible c on c.id=g.last_id join public.athletes a on a.id=g.athlete_id
    left join public.planned_workouts w on w.id=g.planned_workout_id
    left join public.strava_activities s on s.id=g.activity_id
  ) select coalesce(jsonb_agg(to_jsonb(resolved) order by last_comment->>'created_at' desc,subject_id),'[]') into threads from resolved;
  return jsonb_build_object('conversations',conversations,'workout_threads',threads,
    'has_coach',active_coach is not null,'has_messaging',p_mode='coach' or active_coach is not null or jsonb_array_length(threads)>0,
    'unread_total',(select coalesce(sum((x->>'unread')::bigint),0) from jsonb_array_elements(conversations||threads) x));
end $$;
revoke all on function public.messaging_summary(uuid,text) from public,anon,authenticated;
grant execute on function public.messaging_summary(uuid,text) to service_role;

create function public.patch_notification_preferences(p_actor_id uuid,p_patch jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  update public.athletes set notification_preferences=coalesce(notification_preferences,'{}'::jsonb)||p_patch
  where id=p_actor_id returning notification_preferences;
$$;
revoke all on function public.patch_notification_preferences(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.patch_notification_preferences(uuid,jsonb) to service_role;

create function public.notification_feed(p_actor_id uuid,p_before_time timestamptz default null,p_before_id uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with visible as (
    select n.* from public.account_notifications n
    where n.recipient_id=p_actor_id and n.delivery_state='delivered'
      and (n.coach_id is null or n.athlete_id is null or exists (
        select 1 from public.coach_athlete_relationships r
        where r.coach_id=n.coach_id and r.athlete_id=n.athlete_id and r.status='active'))
  ), page as (
    select * from visible where p_before_time is null or (created_at,id)<(p_before_time,p_before_id)
    order by created_at desc,id desc limit 51
  ), displayed as (select * from page order by created_at desc,id desc limit 50)
  select jsonb_build_object('notifications',coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc,id desc) from displayed d),'[]'),
    'unread_count',(select count(*) from visible where read_at is null),
    'next_cursor',case when (select count(*) from page)>50 then
      (select to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')||'|'||id::text from displayed order by created_at,id limit 1) else null end);
$$;
revoke all on function public.notification_feed(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.notification_feed(uuid,timestamptz,uuid) to service_role;
commit;
