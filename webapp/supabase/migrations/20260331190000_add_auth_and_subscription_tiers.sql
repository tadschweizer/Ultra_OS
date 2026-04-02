alter table public.athletes
  add column if not exists supabase_user_id uuid unique;

create index if not exists idx_athletes_supabase_user_id
  on public.athletes (supabase_user_id);

alter table public.athletes
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'research', 'individual', 'coach'));

alter table public.athletes
  add column if not exists subscription_activated_at timestamptz;

alter table public.athletes
  add column if not exists stripe_customer_id text unique;

alter table public.athletes
  add column if not exists stripe_subscription_id text unique;

alter table public.athletes
  add column if not exists stripe_price_id text;

alter table public.athletes
  add column if not exists stripe_subscription_status text;

comment on column public.athletes.subscription_tier is
  'Current app tier: free, research, individual, or coach.';
