-- Demo sandbox accounts (admin testing): flagged so they can be excluded
-- from real-user analytics on /admin and wiped/recreated in bulk.
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_athletes_is_demo
  ON public.athletes (is_demo)
  WHERE is_demo;
