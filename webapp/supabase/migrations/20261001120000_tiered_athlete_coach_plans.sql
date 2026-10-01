-- Athlete Free / Core / Pro and Coach Essentials / Pro plan tiers.
--
-- Only widens the allowed values; existing rows are not rewritten. Code that
-- predates this change reads unknown tiers as 'free', so rewriting rows while it
-- may still be serving would lock paying users out. The application normalizes
-- legacy values on read: research → core, individual → pro, coach → coach_pro.
-- Apply this migration before deploying code that writes the new tier values.

alter table public.athletes
  drop constraint if exists athletes_subscription_tier_check;

alter table public.athletes
  add constraint athletes_subscription_tier_check
  check (subscription_tier in (
    'free', 'core', 'pro', 'coach_essentials', 'coach_pro',
    'research', 'individual', 'coach'
  ));

comment on column public.athletes.subscription_tier is
  'Plan tier: free, core, pro, coach_essentials, or coach_pro. Legacy research/individual/coach values are read as core/pro/coach_pro.';
