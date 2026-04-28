CREATE TABLE IF NOT EXISTS public.coach_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#B8752A',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, name)
);

ALTER TABLE public.coach_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_groups: coaches manage own"
  ON public.coach_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_profiles cp
      JOIN public.athletes a ON a.id = cp.athlete_id
      WHERE cp.id = coach_groups.coach_id
        AND a.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_coach_groups_coach_id
  ON public.coach_groups(coach_id, sort_order, name);

DROP TRIGGER IF EXISTS trg_coach_groups_updated_at ON public.coach_groups;
CREATE TRIGGER trg_coach_groups_updated_at
  BEFORE UPDATE ON public.coach_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
