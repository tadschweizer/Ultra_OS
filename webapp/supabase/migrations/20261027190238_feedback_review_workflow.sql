-- Schema only: no membership grants or owner promotions. Provision separately after approval.
alter table public.site_reviewers add column role text not null default 'contributor' check (role in ('owner','contributor'));
alter table public.site_reviewers add column display_name text not null default 'Reviewer' check (length(display_name) between 1 and 80);
alter table public.site_review_notes drop constraint site_review_notes_status_check;
alter table public.site_review_notes alter column status set default 'pending_review';
update public.site_review_notes set status = case status when 'resolved' then 'completed' else 'pending_review' end;
alter table public.site_review_notes add constraint site_review_notes_status_check check (status in ('pending_review','approved','in_progress','awaiting_acceptance','completed'));
alter table public.site_review_notes add column updated_at timestamptz not null default now();
alter table public.site_review_notes add column version integer not null default 1;
alter table public.site_review_notes add column approved_by uuid references public.athletes(id) on delete set null;
alter table public.site_review_notes add column approved_at timestamptz;
alter table public.site_review_notes add column completed_by uuid references public.athletes(id) on delete set null;
alter table public.site_review_notes add column completed_at timestamptz;
create table public.site_review_events (
  id uuid primary key,
  note_id uuid not null references public.site_review_notes(id) on delete cascade,
  actor_id uuid references public.athletes(id) on delete set null,
  actor_name text not null,
  status text not null,
  message text not null default '' check (length(message) <= 5000),
  created_at timestamptz not null default now(),
  request jsonb not null default '{}'::jsonb
);
create index site_review_events_note_created on public.site_review_events(note_id, created_at);
alter table public.site_review_events enable row level security;
revoke all on public.site_review_events from public, anon, authenticated;
grant select, insert on public.site_review_events to service_role;
insert into public.site_review_events(id,note_id,actor_name,status,message)
select id,id,'Legacy review',status,'Imported from the previous review workflow; prior approval history is unavailable.' from public.site_review_notes;

create function public.write_site_review(p_actor uuid, p_id uuid, p_request uuid, p_action text, p_version integer, p_status text, p_message text, p_path text, p_element text, p_viewport text)
returns public.site_review_notes language plpgsql security invoker set search_path = '' as $$
declare
  member public.site_reviewers;
  task public.site_review_notes;
  prior public.site_review_events;
  fingerprint jsonb := jsonb_build_object('action',p_action,'version',p_version,'status',p_status,'message',p_message,'path',p_path,'element',p_element,'viewport',p_viewport);
begin
  select * into member from public.site_reviewers where athlete_id=p_actor for share;
  if not found then raise exception 'Not permitted' using errcode='42501'; end if;
  if p_id is null or p_request is null or p_message is null or length(p_message)>5000 then raise exception 'Invalid request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into task from public.site_review_notes where id=p_id for update;
  if found and member.role <> 'owner' and task.athlete_id <> p_actor then raise exception 'Not permitted' using errcode='42501'; end if;
  select * into prior from public.site_review_events where id=p_request;
  if found then
    if prior.note_id<>p_id or prior.actor_id is distinct from p_actor or prior.request<>fingerprint then raise exception 'Retry conflict' using errcode='40001'; end if;
    return task;
  end if;
  if p_action='submit' then
    if task.id is not null then raise exception 'Task already exists' using errcode='40001'; end if;
    if length(trim(p_message))=0 or p_path is null or p_path !~ '^/' or p_path ~ '^//|[?#\\[:space:]]' then raise exception 'Invalid submission' using errcode='22023'; end if;
    insert into public.site_review_notes(id,athlete_id,pathname,element,viewport,note)
    values(p_id,p_actor,p_path,coalesce(p_element,''),coalesce(p_viewport,''),p_message) returning * into task;
  elsif p_action in ('update','transition') then
    if task.id is null then raise exception 'Task missing' using errcode='P0002'; end if;
    if p_version is distinct from task.version then raise exception 'Task changed; refresh before retrying' using errcode='40001'; end if;
    if p_action='transition' then
      if member.role <> 'owner' then raise exception 'Owner required' using errcode='42501'; end if;
      if not coalesce((task.status='pending_review' and p_status='approved') or
        (task.status='approved' and p_status='in_progress') or
        (task.status='in_progress' and p_status='awaiting_acceptance') or
        (task.status='awaiting_acceptance' and p_status in ('completed','in_progress')) or
        (task.status='completed' and p_status='pending_review'), false) then raise exception 'Invalid transition' using errcode='22023'; end if;
    elsif length(trim(p_message))=0 then raise exception 'An update is required' using errcode='22023'; end if;
    update public.site_review_notes set
      status=case when p_action='transition' then p_status else status end,
      version=version+1, updated_at=clock_timestamp(),
      approved_by=case when p_action='transition' and p_status='approved' then p_actor when p_action='transition' and p_status='pending_review' then null else approved_by end,
      approved_at=case when p_action='transition' and p_status='approved' then clock_timestamp() when p_action='transition' and p_status='pending_review' then null else approved_at end,
      completed_by=case when p_action='transition' and p_status='completed' then p_actor when p_action='transition' then null else completed_by end,
      completed_at=case when p_action='transition' and p_status='completed' then clock_timestamp() when p_action='transition' then null else completed_at end
      where id=p_id returning * into task;
  else raise exception 'Invalid action' using errcode='22023'; end if;
  insert into public.site_review_events(id,note_id,actor_id,actor_name,status,message,request)
  values(p_request,p_id,p_actor,member.display_name,task.status,p_message,fingerprint);
  return task;
end;
$$;
revoke all on function public.write_site_review(uuid,uuid,uuid,text,integer,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.write_site_review(uuid,uuid,uuid,text,integer,text,text,text,text,text) to service_role;
