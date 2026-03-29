alter table public.athletes
add column if not exists onboarding_complete boolean not null default false,
add column if not exists primary_sports text[] not null default '{}'::text[],
add column if not exists years_racing_band text,
add column if not exists weekly_training_hours_band text,
add column if not exists home_elevation_ft integer;

create table if not exists public.race_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  city text,
  state text,
  country text not null default 'USA',
  distance_miles numeric,
  sport_type text not null
);

alter table public.athletes
add column if not exists target_race_id uuid references public.races (id) on delete set null;

create index if not exists race_catalog_name_idx
  on public.race_catalog using gin (to_tsvector('simple', name));

create index if not exists race_catalog_sport_type_idx
  on public.race_catalog (sport_type);

alter table public.race_catalog disable row level security;
grant select, insert, update, delete on table public.race_catalog to anon, authenticated;

insert into public.race_catalog (name, event_date, city, state, country, distance_miles, sport_type)
values
  ('Western States 100', '2026-06-27', 'Olympic Valley', 'CA', 'USA', 100, 'Ultrarunning'),
  ('Hardrock 100', '2026-07-10', 'Silverton', 'CO', 'USA', 102.5, 'Ultrarunning'),
  ('Leadville Trail 100 Run', '2026-08-15', 'Leadville', 'CO', 'USA', 100, 'Ultrarunning'),
  ('Leadville Trail Marathon', '2026-06-27', 'Leadville', 'CO', 'USA', 26.2, 'Marathon'),
  ('Leadville Silver Rush 50', '2026-07-11', 'Leadville', 'CO', 'USA', 50, 'Ultrarunning'),
  ('Wasatch Front 100', '2026-09-11', 'Kaysville', 'UT', 'USA', 100, 'Ultrarunning'),
  ('Bear 100', '2026-09-25', 'Logan', 'UT', 'USA', 100, 'Ultrarunning'),
  ('Run Rabbit Run 100', '2026-09-18', 'Steamboat Springs', 'CO', 'USA', 100, 'Ultrarunning'),
  ('Black Canyon 100K', '2026-02-14', 'Mayer', 'AZ', 'USA', 62, 'Ultrarunning'),
  ('Black Canyon 50K', '2026-02-14', 'Mayer', 'AZ', 'USA', 31, 'Ultrarunning'),
  ('Canyons 100K', '2026-04-25', 'Auburn', 'CA', 'USA', 62, 'Ultrarunning'),
  ('Canyons 50K', '2026-04-25', 'Auburn', 'CA', 'USA', 31, 'Ultrarunning'),
  ('Javelina Jundred 100M', '2026-10-31', 'Fountain Hills', 'AZ', 'USA', 100, 'Ultrarunning'),
  ('Javelina Jundred 100K', '2026-10-31', 'Fountain Hills', 'AZ', 'USA', 62, 'Ultrarunning'),
  ('UTMB', '2026-08-28', 'Chamonix', null, 'France', 106, 'Ultrarunning'),
  ('CCC', '2026-08-28', 'Courmayeur', null, 'Italy', 62, 'Ultrarunning'),
  ('TDS', '2026-08-26', 'Courmayeur', null, 'Italy', 92, 'Ultrarunning'),
  ('Marathon du Mont-Blanc 42K', '2026-06-28', 'Chamonix', null, 'France', 26.2, 'Marathon'),
  ('Zegama-Aizkorri', '2026-05-24', 'Zegama', null, 'Spain', 26.8, 'Marathon'),
  ('Lavaredo Ultra Trail 120K', '2026-06-26', 'Cortina d''Ampezzo', null, 'Italy', 75, 'Ultrarunning'),
  ('Speedgoat 50K', '2026-07-25', 'Snowbird', 'UT', 'USA', 31, 'Ultrarunning'),
  ('Broken Arrow 46K', '2026-06-21', 'Olympic Valley', 'CA', 'USA', 28.5, 'Ultrarunning'),
  ('Moab 240', '2026-10-09', 'Moab', 'UT', 'USA', 240, 'Ultrarunning'),
  ('Tahoe 200', '2026-09-11', 'Homewood', 'CA', 'USA', 200, 'Ultrarunning'),
  ('Bigfoot 200', '2026-08-14', 'Randle', 'WA', 'USA', 200, 'Ultrarunning'),
  ('Unbound Gravel 200', '2026-05-30', 'Emporia', 'KS', 'USA', 200, 'Gravel Cycling'),
  ('Unbound Gravel 100', '2026-05-30', 'Emporia', 'KS', 'USA', 100, 'Gravel Cycling'),
  ('Belgian Waffle Ride California', '2026-04-26', 'San Diego', 'CA', 'USA', 124, 'Gravel Cycling'),
  ('Belgian Waffle Ride Utah', '2026-05-23', 'Cedar City', 'UT', 'USA', 110, 'Gravel Cycling'),
  ('Belgian Waffle Ride Montana', '2026-06-27', 'Bozeman', 'MT', 'USA', 113, 'Gravel Cycling'),
  ('SBT GRVL Black', '2026-08-16', 'Steamboat Springs', 'CO', 'USA', 125, 'Gravel Cycling'),
  ('SBT GRVL Blue', '2026-08-16', 'Steamboat Springs', 'CO', 'USA', 100, 'Gravel Cycling'),
  ('Crusher in the Tushar', '2026-07-11', 'Beaver', 'UT', 'USA', 69, 'Gravel Cycling'),
  ('The Rift', '2026-07-25', 'Hvolsvollur', null, 'Iceland', 124, 'Gravel Cycling'),
  ('The Traka 200', '2026-05-02', 'Girona', null, 'Spain', 124, 'Gravel Cycling'),
  ('The Traka 100', '2026-05-02', 'Girona', null, 'Spain', 62, 'Gravel Cycling'),
  ('Mid South 100', '2026-03-14', 'Stillwater', 'OK', 'USA', 100, 'Gravel Cycling'),
  ('Rebecca''s Private Idaho', '2026-09-05', 'Ketchum', 'ID', 'USA', 102, 'Gravel Cycling'),
  ('Breck Epic Gravel Prologue', '2026-08-09', 'Breckenridge', 'CO', 'USA', 40, 'Gravel Cycling'),
  ('BWR Arizona', '2026-03-07', 'Scottsdale', 'AZ', 'USA', 110, 'Gravel Cycling'),
  ('BWR Vancouver', '2026-06-13', 'Vancouver', 'BC', 'Canada', 102, 'Gravel Cycling'),
  ('Big Sugar Gravel', '2026-10-17', 'Bentonville', 'AR', 'USA', 103, 'Gravel Cycling'),
  ('Rule of Three', '2026-10-03', 'Bentonville', 'AR', 'USA', 110, 'Gravel Cycling'),
  ('Hoodoo 500 Gravel', '2026-08-22', 'Flagstaff', 'AZ', 'USA', 500, 'Gravel Cycling'),
  ('Land Run 50', '2026-03-14', 'Stillwater', 'OK', 'USA', 50, 'Gravel Cycling'),
  ('IRONMAN World Championship Kona', '2026-10-10', 'Kailua-Kona', 'HI', 'USA', 140.6, 'Long-Course Triathlon'),
  ('IRONMAN 70.3 World Championship', '2026-11-14', 'Nice', null, 'France', 70.3, 'Long-Course Triathlon'),
  ('Challenge Roth', '2026-07-05', 'Roth', null, 'Germany', 140.6, 'Long-Course Triathlon'),
  ('IRONMAN Lake Placid', '2026-07-26', 'Lake Placid', 'NY', 'USA', 140.6, 'Long-Course Triathlon'),
  ('IRONMAN Coeur d''Alene', '2026-06-28', 'Coeur d''Alene', 'ID', 'USA', 140.6, 'Long-Course Triathlon'),
  ('IRONMAN Wisconsin', '2026-09-13', 'Madison', 'WI', 'USA', 140.6, 'Long-Course Triathlon'),
  ('IRONMAN Arizona', '2026-11-22', 'Tempe', 'AZ', 'USA', 140.6, 'Long-Course Triathlon'),
  ('IRONMAN Boulder 70.3', '2026-08-01', 'Boulder', 'CO', 'USA', 70.3, 'Long-Course Triathlon'),
  ('IRONMAN St. George 70.3', '2026-05-02', 'St. George', 'UT', 'USA', 70.3, 'Long-Course Triathlon'),
  ('IRONMAN Oceanside 70.3', '2026-04-11', 'Oceanside', 'CA', 'USA', 70.3, 'Long-Course Triathlon'),
  ('IRONMAN Santa Cruz 70.3', '2026-09-13', 'Santa Cruz', 'CA', 'USA', 70.3, 'Long-Course Triathlon'),
  ('Challenge Daytona', '2026-12-06', 'Daytona Beach', 'FL', 'USA', 140.6, 'Long-Course Triathlon'),
  ('Patriot Half', '2026-06-20', 'East Freetown', 'MA', 'USA', 70.3, 'Long-Course Triathlon'),
  ('Boston Marathon', '2026-04-20', 'Boston', 'MA', 'USA', 26.2, 'Marathon'),
  ('New York City Marathon', '2026-11-01', 'New York', 'NY', 'USA', 26.2, 'Marathon'),
  ('Chicago Marathon', '2026-10-11', 'Chicago', 'IL', 'USA', 26.2, 'Marathon'),
  ('Berlin Marathon', '2026-09-27', 'Berlin', null, 'Germany', 26.2, 'Marathon'),
  ('London Marathon', '2026-04-26', 'London', null, 'United Kingdom', 26.2, 'Marathon'),
  ('CIM', '2026-12-06', 'Sacramento', 'CA', 'USA', 26.2, 'Marathon'),
  ('Pikes Peak Marathon', '2026-09-20', 'Manitou Springs', 'CO', 'USA', 26.2, 'Marathon'),
  ('Boulderthon Half Marathon', '2026-09-27', 'Boulder', 'CO', 'USA', 13.1, 'Half Marathon'),
  ('Boulderthon Marathon', '2026-09-27', 'Boulder', 'CO', 'USA', 26.2, 'Marathon'),
  ('Rock ''n'' Roll Denver Half Marathon', '2026-10-18', 'Denver', 'CO', 'USA', 13.1, 'Half Marathon'),
  ('Colfax Marathon', '2026-05-17', 'Denver', 'CO', 'USA', 26.2, 'Marathon'),
  ('Peachtree Road Race', '2026-07-04', 'Atlanta', 'GA', 'USA', 6.2, '10K'),
  ('Bolder Boulder', '2026-05-25', 'Boulder', 'CO', 'USA', 6.2, '10K'),
  ('Falmouth Road Race', '2026-08-16', 'Falmouth', 'MA', 'USA', 7, 'Other Running'),
  ('Carlsbad 5000', '2026-04-12', 'Carlsbad', 'CA', 'USA', 3.1, '5K'),
  ('Fifth Avenue Mile', '2026-09-13', 'New York', 'NY', 'USA', 1, 'Mile');

