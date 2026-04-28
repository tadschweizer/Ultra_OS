create or replace function public.admin_list_research_library_entries()
returns setof public.research_library_entries
language sql
security definer
set search_path = public
as $$
  select *
  from public.research_library_entries
  order by publication_date desc nulls last, inserted_at desc;
$$;
create or replace function public.admin_upsert_research_library_entry(
  p_id uuid,
  p_pubmed_id text,
  p_title text,
  p_authors text,
  p_journal text,
  p_publication_year integer,
  p_publication_date date,
  p_pubmed_url text,
  p_topic_tags text[],
  p_plain_english_summary text,
  p_practical_takeaway text,
  p_commentary text,
  p_ultra_score integer,
  p_gravel_score integer,
  p_triathlon_score integer,
  p_published boolean
)
returns public.research_library_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_entry public.research_library_entries;
begin
  if p_id is null then
    insert into public.research_library_entries (
      pubmed_id,
      title,
      authors,
      journal,
      publication_year,
      publication_date,
      pubmed_url,
      topic_tags,
      plain_english_summary,
      practical_takeaway,
      commentary,
      ultra_score,
      gravel_score,
      triathlon_score,
      published,
      updated_at
    )
    values (
      p_pubmed_id,
      p_title,
      p_authors,
      p_journal,
      p_publication_year,
      p_publication_date,
      p_pubmed_url,
      coalesce(p_topic_tags, '{}'),
      p_plain_english_summary,
      p_practical_takeaway,
      p_commentary,
      coalesce(p_ultra_score, 0),
      coalesce(p_gravel_score, 0),
      coalesce(p_triathlon_score, 0),
      coalesce(p_published, false),
      now()
    )
    returning * into saved_entry;
  else
    update public.research_library_entries
    set
      pubmed_id = p_pubmed_id,
      title = p_title,
      authors = p_authors,
      journal = p_journal,
      publication_year = p_publication_year,
      publication_date = p_publication_date,
      pubmed_url = p_pubmed_url,
      topic_tags = coalesce(p_topic_tags, '{}'),
      plain_english_summary = p_plain_english_summary,
      practical_takeaway = p_practical_takeaway,
      commentary = p_commentary,
      ultra_score = coalesce(p_ultra_score, 0),
      gravel_score = coalesce(p_gravel_score, 0),
      triathlon_score = coalesce(p_triathlon_score, 0),
      published = coalesce(p_published, false),
      updated_at = now()
    where id = p_id
    returning * into saved_entry;
  end if;

  return saved_entry;
end;
$$;
create or replace function public.admin_delete_research_library_entry(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.research_library_entries where id = p_id;
  return true;
end;
$$;
grant execute on function public.admin_list_research_library_entries() to anon, authenticated;
grant execute on function public.admin_upsert_research_library_entry(uuid, text, text, text, text, integer, date, text, text[], text, text, text, integer, integer, integer, boolean) to anon, authenticated;
grant execute on function public.admin_delete_research_library_entry(uuid) to anon, authenticated;
