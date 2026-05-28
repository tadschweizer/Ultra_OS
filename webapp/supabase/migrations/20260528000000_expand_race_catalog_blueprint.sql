-- Expands race_catalog with fields needed for the Race Blueprint:
-- elevation profile, terrain, course type, average temperature, and source URL.
-- Races discovered via web search are upserted here so future lookups hit the DB.

alter table public.race_catalog
  add column if not exists elevation_gain_ft integer,
  add column if not exists min_elevation_ft  integer,
  add column if not exists max_elevation_ft  integer,
  add column if not exists avg_elevation_ft  integer,
  add column if not exists gain_per_mile_ft  numeric,
  add column if not exists terrain           text,
  add column if not exists course_profile    text,
  add column if not exists avg_temp_f        numeric,
  add column if not exists url               text,
  add column if not exists description       text;
