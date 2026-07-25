-- Conversations on imported activities, not just planned workouts.
--
-- workout_comments could only ever hang off a planned workout, but almost all
-- of what an athlete actually does arrives as an imported activity with no plan
-- attached (688 activities against 3 plans at the time of writing). Those
-- sessions are exactly the ones a coach wants to react to, so the thread has to
-- be able to hang off either subject.
--
-- The table also only recorded which side of the relationship spoke
-- (sender_role), never who. That is enough to colour a bubble and no more, so
-- comments cannot be attributed by name. author_athlete_id records the actual
-- writer.

alter table public.workout_comments
  alter column planned_workout_id drop not null;

alter table public.workout_comments
  add column if not exists activity_id uuid
    references public.strava_activities (id) on delete cascade,
  add column if not exists author_athlete_id uuid
    references public.athletes (id) on delete set null;

-- A comment belongs to exactly one subject. Without this a row could point at
-- both a plan and an activity, and the two calendar surfaces would disagree
-- about which thread it belongs to.
alter table public.workout_comments
  drop constraint if exists workout_comments_one_subject;

alter table public.workout_comments
  add constraint workout_comments_one_subject
  check (num_nonnulls(planned_workout_id, activity_id) = 1);

create index if not exists idx_workout_comments_activity_created
  on public.workout_comments (activity_id, created_at);

-- Backfill authorship for rows written before the column existed. An athlete
-- comment was written by the thread's athlete; a coach comment by whichever
-- athlete account backs that coach profile.
update public.workout_comments c
   set author_athlete_id = c.athlete_id
 where c.author_athlete_id is null
   and c.sender_role = 'athlete';

update public.workout_comments c
   set author_athlete_id = p.athlete_id
  from public.coach_profiles p
 where c.author_athlete_id is null
   and c.sender_role = 'coach'
   and c.coach_id = p.id;

-- RLS stays enabled with no policies: every read and write goes through the
-- service-role API routes, which authorize ownership or an active coaching
-- relationship per request. This matches calendar_notes.
alter table public.workout_comments enable row level security;
