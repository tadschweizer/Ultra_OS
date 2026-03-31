-- ============================================================
-- Migration 001: Add auth provider + subscription tier columns
-- Run this in your Supabase SQL editor before deploying auth changes.
-- ============================================================

-- 1. Link athletes to Supabase Auth users (email/password and OAuth logins)
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE;

-- Index for fast lookup by supabase_user_id on every login
CREATE INDEX IF NOT EXISTS idx_athletes_supabase_user_id ON athletes (supabase_user_id);

-- 2. Subscription tier — source of truth (replaces localStorage planUtils)
--    free       = free tier (15 intervention limit, 3 check-ins/week)
--    individual = paid individual ($29/mo or $240/yr)
--    coach      = paid coach ($69/mo or $580/yr)
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'individual', 'coach'));

-- 3. Track when the subscription was last activated (for Stripe webhook use later)
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMPTZ;

-- 4. Stripe customer ID — needed when you wire up Stripe billing
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- ============================================================
-- Notes:
-- • intervention_count and check-in counts are NOT stored here —
--   they are computed live from the interventions table by tierGates.js.
--   This avoids count drift and keeps the DB simple.
-- • supabase_user_id is NULL for the original Strava-only account
--   (athlete created via Strava callback before this migration).
--   On next email/Google login that athlete can be linked by matching email.
-- • Run this with your service role or as the postgres superuser.
-- ============================================================
