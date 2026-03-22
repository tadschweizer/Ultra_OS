insert into public.research_library_entries (
  pubmed_id,
  title,
  authors,
  journal,
  publication_year,
  pubmed_url,
  topic_tags,
  plain_english_summary,
  practical_takeaway,
  commentary,
  ultra_score,
  gravel_score,
  triathlon_score,
  published
)
values (
  'draft-respiratory-001',
  'Inspiratory Muscle Training and Endurance Performance',
  'Draft import',
  'PubMed draft',
  2026,
  'https://pubmed.ncbi.nlm.nih.gov/',
  array['Respiratory Training', 'Recovery'],
  'Draft summary pending review.',
  'Draft takeaway pending review.',
  'Hidden draft entry for admin workflow verification.',
  3,
  2,
  2,
  false
)
on conflict (pubmed_id) do update
set
  title = excluded.title,
  authors = excluded.authors,
  journal = excluded.journal,
  publication_year = excluded.publication_year,
  pubmed_url = excluded.pubmed_url,
  topic_tags = excluded.topic_tags,
  plain_english_summary = excluded.plain_english_summary,
  practical_takeaway = excluded.practical_takeaway,
  commentary = excluded.commentary,
  ultra_score = excluded.ultra_score,
  gravel_score = excluded.gravel_score,
  triathlon_score = excluded.triathlon_score,
  published = excluded.published,
  updated_at = now();
