-- Training calendar: planned workouts + reusable workout library.
--
-- This is the foundation of the coaching workflow: coaches build structured
-- workouts on an athlete's calendar (athletes can also self-plan), completed
-- activities are matched against the plan, and compliance is computed at
-- read time.

-- ── Workout library (reusable structured workouts owned by a coach) ─────────
CREATE TABLE IF NOT EXISTS public.workout_library (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id              uuid        NOT NULL
                                    REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  sport                 text        NOT NULL DEFAULT 'run',
  description           text,
  -- Ordered list of steps:
  -- [{ "type": "warmup"|"work"|"recovery"|"cooldown"|"rest",
  --    "repeat": 1, "duration_min": 10, "distance_km": null,
  --    "intensity": "z2"|"z3"|"z4"|"z5"|"tempo"|"threshold"|"vo2"|"easy",
  --    "notes": "..." }]
  structure             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  planned_duration_min  numeric,
  planned_distance_km   numeric,
  planned_tss           numeric,
  tags                  text[],
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_library_coach_id
  ON public.workout_library (coach_id);

ALTER TABLE public.workout_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_library: coaches manage own"
  ON public.workout_library FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE cp.id               = workout_library.coach_id
         AND a.supabase_user_id  = auth.uid()
    )
  );

-- ── Planned workouts (the calendar itself) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planned_workouts (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  athlete_id             uuid        NOT NULL
                                     REFERENCES public.athletes(id) ON DELETE CASCADE,

  -- Null when the athlete planned the workout themselves
  coach_id               uuid        REFERENCES public.coach_profiles(id) ON DELETE SET NULL,

  workout_date           date        NOT NULL,
  sport                  text        NOT NULL DEFAULT 'run',
  title                  text        NOT NULL,
  description            text,
  structure              jsonb       NOT NULL DEFAULT '[]'::jsonb,

  planned_duration_min   numeric,
  planned_distance_km    numeric,
  planned_tss            numeric,

  -- Position within the day when multiple workouts are scheduled
  order_index            integer     NOT NULL DEFAULT 0,

  status                 text        NOT NULL DEFAULT 'planned'
                                     CHECK (status IN ('planned', 'completed', 'skipped')),

  -- Completion data (manual entry or matched from a synced activity)
  completed_activity_id  text,
  completed_duration_min numeric,
  completed_distance_km  numeric,
  athlete_rpe            integer     CHECK (athlete_rpe BETWEEN 1 AND 10),
  athlete_comment        text,
  coach_feedback         text,

  library_workout_id     uuid        REFERENCES public.workout_library(id) ON DELETE SET NULL,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planned_workouts_athlete_date
  ON public.planned_workouts (athlete_id, workout_date);

CREATE INDEX IF NOT EXISTS idx_planned_workouts_coach_id
  ON public.planned_workouts (coach_id);

ALTER TABLE public.planned_workouts ENABLE ROW LEVEL SECURITY;

-- Coaches manage workouts they assigned
CREATE POLICY "planned_workouts: coaches manage own"
  ON public.planned_workouts FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.coach_profiles cp
        JOIN public.athletes       a  ON a.id = cp.athlete_id
       WHERE cp.id               = planned_workouts.coach_id
         AND a.supabase_user_id  = auth.uid()
    )
  );

-- Athletes can read everything on their own calendar
CREATE POLICY "planned_workouts: athletes read own"
  ON public.planned_workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.athletes a
       WHERE a.id              = planned_workouts.athlete_id
         AND a.supabase_user_id = auth.uid()
    )
  );

-- Athletes manage workouts they planned themselves (coach_id IS NULL)
CREATE POLICY "planned_workouts: athletes manage self-planned"
  ON public.planned_workouts FOR ALL
  USING (
    planned_workouts.coach_id IS NULL
    AND EXISTS (
      SELECT 1
        FROM public.athletes a
       WHERE a.id              = planned_workouts.athlete_id
         AND a.supabase_user_id = auth.uid()
    )
  );

-- Athletes can update completion fields on coach-assigned workouts; column
-- restrictions are enforced in the API layer (service role), this policy
-- covers direct client access.
CREATE POLICY "planned_workouts: athletes update own"
  ON public.planned_workouts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
        FROM public.athletes a
       WHERE a.id              = planned_workouts.athlete_id
         AND a.supabase_user_id = auth.uid()
    )
  );
