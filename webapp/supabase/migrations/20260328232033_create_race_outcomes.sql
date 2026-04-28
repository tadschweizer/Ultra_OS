CREATE TABLE IF NOT EXISTS race_outcomes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id           uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  race_name            text NOT NULL,
  race_date            date,
  race_type            text,
  finish_outcome       text,         -- 'finished', 'dnf', 'dns', 'pacer_only'
  finish_time_minutes  integer,
  goal_time_minutes    integer,
  overall_rating       integer CHECK (overall_rating BETWEEN 1 AND 10),
  gi_distress_score    integer CHECK (gi_distress_score BETWEEN 1 AND 10),
  energy_management    text,
  pacing_strategy      text,
  peak_hr_bpm          integer,
  avg_hr_bpm           integer,
  avg_carbs_g_per_hr   numeric(6,2),
  total_fluid_l        numeric(5,2),
  heat_impact          text,
  what_worked          text,
  what_to_change       text,
  would_use_again      text,
  notes                text,
  inserted_at          timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-athlete lookups
CREATE INDEX IF NOT EXISTS race_outcomes_athlete_id_idx ON race_outcomes (athlete_id, race_date DESC);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_race_outcomes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER race_outcomes_updated_at
  BEFORE UPDATE ON race_outcomes
  FOR EACH ROW EXECUTE FUNCTION update_race_outcomes_updated_at();

-- RLS: athletes can only see and modify their own outcomes
ALTER TABLE race_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can read own race outcomes"
  ON race_outcomes FOR SELECT
  USING (athlete_id::text = current_setting('request.cookies', true)::json->>'athlete_id');

CREATE POLICY "Athletes can insert own race outcomes"
  ON race_outcomes FOR INSERT
  WITH CHECK (athlete_id::text = current_setting('request.cookies', true)::json->>'athlete_id');

CREATE POLICY "Athletes can update own race outcomes"
  ON race_outcomes FOR UPDATE
  USING (athlete_id::text = current_setting('request.cookies', true)::json->>'athlete_id');;
