alter table public.interventions
add column if not exists activity_provider text
  check (activity_provider in ('strava', 'garmin', 'trainingpeaks'));
