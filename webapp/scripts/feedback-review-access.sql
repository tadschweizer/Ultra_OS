-- REVIEW ONLY. Do not execute without specific approval for these permission changes.
-- Run only after the schema migration and exact identity verification.
-- Never create an account or substitute an alternative email here.
begin;
do $$
declare owner_id uuid; contributor_id uuid; matches integer;
begin
  select count(*), min(a.id::text)::uuid into matches, owner_id
    from public.athletes a join auth.users u on u.id=a.supabase_user_id
    join public.site_reviewers r on r.athlete_id=a.id
    where u.email='tadschweizer@gmail.com' and u.email_confirmed_at is not null
      and a.is_admin is true;
  if matches<>1 then raise exception 'Verified existing owner identity is missing or ambiguous'; end if;
  select count(*), min(a.id::text)::uuid into matches, contributor_id
    from public.athletes a join auth.users u on u.id=a.supabase_user_id
    where u.email='bethschweizer@gmail.com' and u.email_confirmed_at is not null;
  if matches<>1 then raise exception 'Exact verified Beth identity is missing or ambiguous; stop and confirm the login'; end if;
  if contributor_id=owner_id then raise exception 'Owner and contributor must differ'; end if;
  if exists(select 1 from public.site_reviewers where athlete_id=contributor_id and role='owner') then
    raise exception 'Contributor already has owner membership; investigate separately';
  end if;
  update public.site_reviewers set role='owner',display_name='Tad' where athlete_id=owner_id;
  insert into public.site_reviewers(athlete_id,role,display_name) values(contributor_id,'contributor','Beth')
    on conflict(athlete_id) do nothing;
end $$;
commit;
