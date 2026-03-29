-- ─────────────────────────────────────────────────────────────────
-- M2: Invite system + admin flag
-- ─────────────────────────────────────────────────────────────────

-- 1. Add is_admin boolean to athletes (defaults false)
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create invites table
CREATE TABLE IF NOT EXISTS invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT NOT NULL UNIQUE,
  email         TEXT,                        -- optional: pre-fill during join
  created_by    UUID REFERENCES athletes(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at       TIMESTAMPTZ,
  used_by       UUID REFERENCES athletes(id),
  notes         TEXT                         -- admin notes (e.g. "for Tad's running club")
);

-- 3. Index for fast token lookups on the /join page
CREATE INDEX IF NOT EXISTS invites_token_idx ON invites (token);

-- ─── Row Level Security ───────────────────────────────────────────

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Only admins can INSERT new invites (enforced in API, but belt-and-suspenders)
-- The API uses the service role key for invite creation, so we just need
-- to prevent leakage: no public SELECT on the full invites table.
-- The /join page validates tokens via a server-side API that uses the service role.

-- Allow admins to read all invites (useful for the /admin page)
CREATE POLICY "Admins can read all invites"
  ON invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM athletes
      WHERE athletes.id = auth.uid()
        AND athletes.is_admin = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- NOTE: Run this migration in the Supabase SQL editor or via CLI.
-- After running, set your own athlete row to is_admin = true:
--   UPDATE athletes SET is_admin = true WHERE id = '<your-athlete-id>';
-- ─────────────────────────────────────────────────────────────────
