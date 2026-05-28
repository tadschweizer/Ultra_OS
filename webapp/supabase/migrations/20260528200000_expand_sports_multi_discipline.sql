-- Expand coaching platform to support multi-discipline sports beyond ultrarunning,
-- gravel cycling, and triathlon. Adds sport score columns to the research library,
-- seeds a sports registry table, and adds race/event catalog entries for speed
-- skating, road cycling, lacrosse, soccer, rowing, swimming, Nordic skiing,
-- biathlon, and paddling.

-- ─── 1. Add sport relevance score columns to research_library_entries ────────

alter table public.research_library_entries
  add column if not exists running_score    integer not null default 0
    constraint research_library_entries_running_score_check    check (running_score    between 0 and 5),
  add column if not exists cycling_score    integer not null default 0
    constraint research_library_entries_cycling_score_check    check (cycling_score    between 0 and 5),
  add column if not exists swimming_score   integer not null default 0
    constraint research_library_entries_swimming_score_check   check (swimming_score   between 0 and 5),
  add column if not exists rowing_score     integer not null default 0
    constraint research_library_entries_rowing_score_check     check (rowing_score     between 0 and 5),
  add column if not exists skating_score    integer not null default 0
    constraint research_library_entries_skating_score_check    check (skating_score    between 0 and 5),
  add column if not exists ski_score        integer not null default 0
    constraint research_library_entries_ski_score_check        check (ski_score        between 0 and 5),
  add column if not exists team_sport_score integer not null default 0
    constraint research_library_entries_team_sport_score_check check (team_sport_score between 0 and 5);

-- ─── 2. Backfill new score columns from existing scores for known articles ───
-- Articles with high ultra_score → high running_score
-- Articles with high gravel_score → high cycling_score
-- Articles about rowing, skating, skiing already have tags we can map

update public.research_library_entries
set
  running_score = least(5, greatest(ultra_score, triathlon_score - 1)),
  cycling_score = gravel_score;

-- Rowing-specific articles
update public.research_library_entries
set rowing_score = 5
where 'Rowing' = any(topic_tags);

-- Paddling / canoeing articles
update public.research_library_entries
set rowing_score = greatest(rowing_score, 4)
where 'Paddling' = any(topic_tags);

-- Open-water swim articles
update public.research_library_entries
set swimming_score = 5
where 'Open Water Swimming' = any(topic_tags);

-- Triathlon articles have a swim leg
update public.research_library_entries
set swimming_score = greatest(swimming_score, triathlon_score - 1)
where triathlon_score > 0;

-- Winter sports articles
update public.research_library_entries
set
  ski_score    = 4,
  skating_score = 3
where topic_tags && array['Periodization', 'Training Methodology']
  and (title ilike '%ski%' or title ilike '%winter%' or title ilike '%biathlon%' or title ilike '%cross-country%');

-- Biathlon articles get skating + ski
update public.research_library_entries
set
  ski_score     = greatest(ski_score, 4),
  skating_score = greatest(skating_score, 2)
where title ilike '%biathlon%';

-- Speed skating mentioned in coaching paper
update public.research_library_entries
set skating_score = greatest(skating_score, 4)
where title ilike '%strength and speed training%' or title ilike '%olympic endurance%';

-- Team sport — general endurance research has moderate relevance
update public.research_library_entries
set team_sport_score = 2
where topic_tags && array['Recovery', 'Training Methodology', 'Strength Training'];

-- ─── 3. Sports registry table ────────────────────────────────────────────────

create table if not exists public.sports_registry (
  id            uuid primary key default gen_random_uuid(),
  sport_key     text not null unique,
  display_name  text not null,
  sport_group   text not null,
  strava_types  text[] not null default '{}',
  activity_family text not null,
  score_column  text,
  description   text,
  inserted_at   timestamptz default now()
);

insert into public.sports_registry (sport_key, display_name, sport_group, strava_types, activity_family, score_column, description)
values
  -- Running
  ('ultrarunner',        'Ultrarunner',             'Running',      array['TrailRun','Run'],                      'run',      'ultra_score',     '50K and beyond on trails or roads'),
  ('trail_runner',       'Trail Runner',             'Running',      array['TrailRun','Run'],                      'run',      'ultra_score',     'Off-road running on trails and mountains'),
  ('marathoner',         'Marathoner',               'Running',      array['Run'],                                 'run',      'running_score',   'Road marathon 26.2 miles'),
  ('half_marathoner',    'Half Marathoner',          'Running',      array['Run'],                                 'run',      'running_score',   'Road half marathon 13.1 miles'),
  ('road_racer',         'Road Racer (5K-10K)',      'Running',      array['Run'],                                 'run',      'running_score',   'Short-course road racing'),
  -- Cycling
  ('gravel_cyclist',     'Gravel Cyclist',           'Cycling',      array['GravelRide','Ride'],                   'bike',     'gravel_score',    'Off-road gravel and mixed-surface cycling'),
  ('road_cyclist',       'Road Cyclist',             'Cycling',      array['Ride'],                                'bike',     'cycling_score',   'Road cycling including gran fondos and crits'),
  ('mountain_biker',     'Mountain Biker',           'Cycling',      array['MountainBikeRide','EMountainBikeRide'],'bike',     'cycling_score',   'Off-road mountain biking'),
  -- Multi-sport
  ('long_tri',           'Long-Course Triathlete',   'Multi-Sport',  array['Run','Ride','Swim','OpenWaterSwim'],   'run',      'triathlon_score', 'IRONMAN 70.3 and full-distance triathlon'),
  ('short_tri',          'Short-Course Triathlete',  'Multi-Sport',  array['Run','Ride','Swim','OpenWaterSwim'],   'run',      'triathlon_score', 'Olympic and sprint triathlon'),
  -- Aquatic
  ('ow_swimmer',         'Open-Water Swimmer',       'Aquatic',      array['OpenWaterSwim'],                       'swim',     'swimming_score',  'Open-water racing from 1K to marathon swims'),
  ('pool_swimmer',       'Pool Swimmer',             'Aquatic',      array['Swim'],                                'swim',     'swimming_score',  'Pool competition across sprint to distance events'),
  ('rower',              'Rower',                    'Aquatic',      array['Rowing','VirtualRow'],                 'row',      'rowing_score',    'Sweep and sculling rowing on water or erg'),
  ('paddler',            'Paddler (Kayak / Canoe)',  'Aquatic',      array['Kayaking','Canoeing','StandUpPaddling'],'row',     'rowing_score',    'Kayak, canoe, and stand-up paddleboard racing'),
  -- Winter / Ice
  ('speed_skater',       'Speed Skater',             'Winter / Ice', array['IceSkate','InlineSkate'],              'skate',    'skating_score',   'Long-track and short-track speed skating'),
  ('xc_skier',           'Cross-Country Skier',      'Winter / Ice', array['NordicSki','CrossCountrySkiing','RollerSki'],'ski','ski_score',      'Cross-country / Nordic skiing classic and skate'),
  ('biathlete',          'Biathlete',                'Winter / Ice', array['NordicSki','RollerSki'],               'ski',      'ski_score',       'Nordic skiing combined with rifle marksmanship'),
  -- Team Sports
  ('soccer_player',      'Soccer Player',            'Team Sports',  array['Soccer'],                              'team',     'team_sport_score','Association football / soccer'),
  ('lacrosse_player',    'Lacrosse Player',          'Team Sports',  array['Lacrosse'],                            'team',     'team_sport_score','Field or box lacrosse')
on conflict (sport_key) do update
  set
    display_name    = excluded.display_name,
    sport_group     = excluded.sport_group,
    strava_types    = excluded.strava_types,
    activity_family = excluded.activity_family,
    score_column    = excluded.score_column,
    description     = excluded.description;

-- ─── 4. Race catalog — new sport event seeds ─────────────────────────────────

insert into public.race_catalog (name, event_date, city, state, country, distance_miles, sport_type)
values

  -- ── Speed Skating ───────────────────────────────────────────────────────
  ('US Speed Skating Long Track Trials',         '2026-01-10', 'Kearns',        'UT',  'USA',         0.3, 'Speed Skating'),
  ('ISU World Sprint Speed Skating Championships','2026-02-07', 'Calgary',       null,  'Canada',      0.6, 'Speed Skating'),
  ('ISU World Allround Championships',           '2026-02-14', 'Amsterdam',     null,  'Netherlands', 6.2, 'Speed Skating'),
  ('ISU World Single Distance Championships',    '2026-03-07', 'Inzell',        null,  'Germany',     6.2, 'Speed Skating'),
  ('ISU World Cup Long Track Final',             '2026-03-14', 'Heerenveen',    null,  'Netherlands', 6.2, 'Speed Skating'),
  ('Inline Speed Skating World Championships',   '2026-09-05', 'Geisingen',     null,  'Germany',     6.2, 'Inline Skating'),
  ('Great Plains Speed Skate',                   '2026-01-17', 'Kansas City',   'MO',  'USA',         0.6, 'Speed Skating'),
  ('Chicago Distance Classic (Inline)',          '2026-08-01', 'Chicago',       'IL',  'USA',         26.2,'Inline Skating'),
  ('Athens to Atlanta Road Skate',               '2026-10-10', 'Athens',        'GA',  'USA',         87.0,'Inline Skating'),

  -- ── Rowing ──────────────────────────────────────────────────────────────
  ('Head of the Charles Regatta',                '2026-10-17', 'Cambridge',     'MA',  'USA',         3.0, 'Rowing'),
  ('Head of the Schuylkill Regatta',             '2026-10-24', 'Philadelphia',  'PA',  'USA',         3.0, 'Rowing'),
  ('FISA World Rowing Championships',            '2026-09-13', 'Aiguebelette',  null,  'France',      1.2, 'Rowing'),
  ('USRowing Nationals',                         '2026-07-11', 'Sarasota',      'FL',  'USA',         1.2, 'Rowing'),
  ('San Diego Crew Classic',                     '2026-04-05', 'San Diego',     'CA',  'USA',         1.2, 'Rowing'),
  ('Dad Vail Regatta',                           '2026-05-09', 'Philadelphia',  'PA',  'USA',         1.2, 'Rowing'),
  ('Craftsbury Ergatta',                         '2026-02-14', 'Craftsbury',    'VT',  'USA',         1.2, 'Rowing'),
  ('C.R.A.S.H.-B. World Indoor Rowing Sprints',  '2026-02-22', 'Boston',        'MA',  'USA',         1.2, 'Indoor Rowing'),
  ('Concept2 Holiday Challenge',                 '2026-12-01', 'Virtual',       null,  'USA',         200.0,'Indoor Rowing'),

  -- ── Open-Water Swimming ─────────────────────────────────────────────────
  ('Escape from Alcatraz Swim',                  '2026-09-06', 'San Francisco', 'CA',  'USA',         1.5, 'Open Water Swim'),
  ('English Channel Solo Crossing',              '2026-08-01', 'Dover',         null,  'UK',          21.0,'Open Water Swim'),
  ('FINA World Open Water 10K',                  '2026-07-18', 'Various',       null,  'International',6.2,'Open Water Swim'),
  ('Great Chesapeake Bay Swim',                  '2026-06-14', 'Sandy Point',   'MD',  'USA',         4.4, 'Open Water Swim'),
  ('Swim the Suck',                              '2026-10-10', 'Chattanooga',   'TN',  'USA',         10.0,'Open Water Swim'),
  ('Tampa Bay Marathon Swim',                    '2026-01-25', 'Tampa',         'FL',  'USA',         24.0,'Open Water Swim'),
  ('The Brutal (Ireland)',                       '2026-07-04', 'Achill Island', null,  'Ireland',     1.5, 'Open Water Swim'),
  ('New York Swim 5K',                           '2026-07-26', 'New York',      'NY',  'USA',         3.1, 'Open Water Swim'),
  ('Donner Lake Open Water Swim',                '2026-08-08', 'Truckee',       'CA',  'USA',         3.1, 'Open Water Swim'),

  -- ── Paddling ────────────────────────────────────────────────────────────
  ('ICF Canoe Sprint World Championships',       '2026-08-22', 'Duisburg',      null,  'Germany',     0.6, 'Paddling Race'),
  ('Missouri River 340',                         '2026-07-21', 'Kansas City',   'MO',  'USA',         340.0,'Paddling Race'),
  ('Yukon River Quest',                          '2026-06-22', 'Whitehorse',    null,  'Canada',      460.0,'Paddling Race'),
  ('Adirondack Canoe Classic (90-Miler)',        '2026-09-11', 'Old Forge',     'NY',  'USA',         90.0,'Paddling Race'),
  ('AuSable River Canoe Marathon',               '2026-06-27', 'Grayling',      'MI',  'USA',         120.0,'Paddling Race'),
  ('Carolina Cup (SUP)',                         '2026-04-25', 'Wrightsville Beach','NC','USA',       12.4,'Paddling Race'),
  ('Battle of the Paddle (SUP)',                 '2026-10-03', 'Dana Point',    'CA',  'USA',         12.4,'Paddling Race'),

  -- ── Nordic / Cross-Country Skiing ───────────────────────────────────────
  ('American Birkebeiner',                       '2026-02-21', 'Hayward',       'WI',  'USA',         31.0,'Nordic Ski Race'),
  ('Vasaloppet',                                 '2026-03-01', 'Sälen',         null,  'Sweden',      56.0,'Nordic Ski Race'),
  ('FIS Nordic World Ski Championships',         '2026-02-19', 'Trondheim',     null,  'Norway',      30.0,'Nordic Ski Race'),
  ('Engadin Ski Marathon',                       '2026-03-08', 'Maloja',        null,  'Switzerland', 26.2,'Nordic Ski Race'),
  ('Tour de Ski Final',                          '2026-01-05', 'Val di Fiemme', null,  'Italy',       6.2, 'Nordic Ski Race'),
  ('Gatineau Loppet',                            '2026-02-14', 'Gatineau',      null,  'Canada',      31.0,'Nordic Ski Race'),
  ('Great Bear Chase',                           '2026-02-28', 'Calumet',       'MI',  'USA',         31.0,'Nordic Ski Race'),
  ('Boulder Mountain Tour',                      '2026-02-07', 'Ketchum',       'ID',  'USA',         34.0,'Nordic Ski Race'),
  ('Stowe Derby',                                '2026-02-01', 'Stowe',         'VT',  'USA',         4.0, 'Nordic Ski Race'),

  -- ── Biathlon ────────────────────────────────────────────────────────────
  ('IBU Biathlon World Championships',           '2026-02-12', 'Kontiolahti',   null,  'Finland',     12.4,'Biathlon'),
  ('IBU Biathlon World Cup Oberhof',             '2026-01-08', 'Oberhof',       null,  'Germany',     12.4,'Biathlon'),
  ('US Biathlon National Championships',         '2026-03-14', 'Lake Placid',   'NY',  'USA',         12.4,'Biathlon'),

  -- ── Soccer ──────────────────────────────────────────────────────────────
  ('US Adult Soccer Nationals',                  '2026-06-27', 'Various',       null,  'USA',         0.0, 'Soccer'),
  ('USYS National Championship',                 '2026-07-11', 'Various',       null,  'USA',         0.0, 'Soccer'),
  ('MLS All-Star Game',                          '2026-07-29', 'Various',       null,  'USA',         0.0, 'Soccer'),
  ('NWSL Challenge Cup',                         '2026-03-14', 'Various',       null,  'USA',         0.0, 'Soccer'),
  ('FIFA Club World Cup 2026',                   '2026-06-15', 'Various',       null,  'USA',         0.0, 'Soccer'),
  ('US Open Cup',                                '2026-09-16', 'Various',       null,  'USA',         0.0, 'Soccer'),

  -- ── Lacrosse ────────────────────────────────────────────────────────────
  ('NCAA Men''s Lacrosse Final Four',            '2026-05-23', 'Various',       null,  'USA',         0.0, 'Lacrosse'),
  ('NCAA Women''s Lacrosse Championship',        '2026-05-24', 'Various',       null,  'USA',         0.0, 'Lacrosse'),
  ('NLL Championship Weekend',                   '2026-06-06', 'Various',       null,  'USA',         0.0, 'Lacrosse'),
  ('PLL Championship Weekend',                   '2026-09-12', 'Various',       null,  'USA',         0.0, 'Lacrosse'),
  ('FIL World Lacrosse Championship',            '2026-09-26', 'San Diego',     'CA',  'USA',         0.0, 'Lacrosse'),
  ('US Club Lacrosse Nationals',                 '2026-07-18', 'Columbus',      'OH',  'USA',         0.0, 'Lacrosse'),
  ('Vail Lacrosse Shootout',                     '2026-06-27', 'Vail',          'CO',  'USA',         0.0, 'Lacrosse')

on conflict do nothing;

-- ─── 5. RLS — sports_registry is public-readable ─────────────────────────────

alter table public.sports_registry enable row level security;

drop policy if exists "Sports registry is public readable" on public.sports_registry;
create policy "Sports registry is public readable"
  on public.sports_registry
  for select
  using (true);

grant select on table public.sports_registry to anon, authenticated;
