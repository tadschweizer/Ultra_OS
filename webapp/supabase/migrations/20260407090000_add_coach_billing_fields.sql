alter table public.coach_profiles
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;
