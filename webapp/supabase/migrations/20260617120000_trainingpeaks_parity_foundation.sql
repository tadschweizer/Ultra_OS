-- TrainingPeaks-style parity foundation: richer planned workouts, notes,
-- comments, training plans, notifications, imports, exports, and attachments.

ALTER TABLE public.planned_workouts
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS coach_instructions text,
  ADD COLUMN IF NOT EXISTS target_metric text NOT NULL DEFAULT 'duration',
  ADD COLUMN IF NOT EXISTS planned_if numeric,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'athlete_visible',
  ADD COLUMN IF NOT EXISTS export_status text NOT NULL DEFAULT 'not_exported',
  ADD COLUMN IF NOT EXISTS sync_provider text,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS paired_manually boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.workout_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_workout_id uuid NOT NULL REFERENCES public.planned_workouts(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coach_profiles(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('coach', 'athlete')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_workout_comments_workout_created ON public.workout_comments(planned_workout_id, created_at);

CREATE TABLE IF NOT EXISTS public.calendar_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coach_profiles(id) ON DELETE SET NULL,
  note_date date NOT NULL,
  title text NOT NULL,
  body text,
  visibility text NOT NULL DEFAULT 'athlete_visible' CHECK (visibility IN ('athlete_visible', 'coach_private')),
  note_type text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_athlete_date ON public.calendar_notes(athlete_id, note_date);

CREATE TABLE IF NOT EXISTS public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sport text NOT NULL DEFAULT 'run',
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_plan_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id uuid NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number > 0),
  day_offset integer NOT NULL CHECK (day_offset >= 0),
  sport text NOT NULL DEFAULT 'run',
  title text NOT NULL,
  description text,
  objective text,
  coach_instructions text,
  structure jsonb NOT NULL DEFAULT '[]'::jsonb,
  planned_duration_min numeric,
  planned_distance_km numeric,
  planned_tss numeric,
  target_metric text NOT NULL DEFAULT 'duration',
  planned_if numeric,
  order_index integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_training_plan_workouts_plan ON public.training_plan_workouts(training_plan_id, week_number, day_offset);

CREATE TABLE IF NOT EXISTS public.coach_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_notifications_coach_created ON public.coach_notifications(coach_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.trainingpeaks_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coach_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  transferred_count integer NOT NULL DEFAULT 0,
  needs_manual_mapping_count integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainingpeaks_import_jobs_athlete ON public.trainingpeaks_import_jobs(athlete_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_athlete_id uuid REFERENCES public.athletes(id) ON DELETE SET NULL,
  linked_entity_type text NOT NULL,
  linked_entity_id uuid NOT NULL,
  file_name text NOT NULL,
  content_type text,
  byte_size bigint,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON public.attachments(linked_entity_type, linked_entity_id);
