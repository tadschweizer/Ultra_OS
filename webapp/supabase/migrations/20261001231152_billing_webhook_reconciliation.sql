-- Durable webhook receipts and per-customer leases. No event payloads or secrets.
-- Apply this migration before deploying the updated webhook handler.
begin;
create schema if not exists billing_private;
revoke all on schema billing_private from public, anon, authenticated;
grant usage on schema billing_private to service_role;
create table if not exists billing_private.webhook_receipts (
  event_id text primary key,
  customer_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create table if not exists billing_private.customer_leases (
  customer_id text primary key,
  event_id text not null,
  lease_token uuid not null,
  expires_at timestamptz not null
);
alter table billing_private.webhook_receipts enable row level security;
alter table billing_private.customer_leases enable row level security;
revoke all on all tables in schema billing_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema billing_private to service_role;

create or replace function public.claim_billing_webhook(p_event_id text, p_customer_id text, p_event_type text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare receipt billing_private.webhook_receipts%rowtype;
  token uuid := gen_random_uuid(); acquired uuid;
begin
  if p_event_id is null or p_customer_id is null or p_event_type is null then
    raise exception 'Missing webhook identity';
  end if;
  insert into billing_private.webhook_receipts(event_id, customer_id, event_type)
    values(p_event_id, p_customer_id, p_event_type) on conflict do nothing;
  select * into receipt from billing_private.webhook_receipts where event_id = p_event_id for update;
  if receipt.customer_id <> p_customer_id or receipt.event_type <> p_event_type then
    raise exception 'Webhook identity mismatch';
  end if;
  if receipt.processed_at is not null then return jsonb_build_object('duplicate', true); end if;
  insert into billing_private.customer_leases(customer_id, event_id, lease_token, expires_at)
    values(p_customer_id, p_event_id, token, clock_timestamp() + interval '90 seconds')
    on conflict(customer_id) do update set event_id = excluded.event_id,
      lease_token = excluded.lease_token, expires_at = excluded.expires_at
      where billing_private.customer_leases.expires_at <= clock_timestamp()
    returning lease_token into acquired;
  if acquired is null then return jsonb_build_object('busy', true); end if;
  return jsonb_build_object('lease_token', token);
end $$;

create or replace function public.finish_billing_webhook(p_event_id text, p_customer_id text,
  p_lease_token uuid, p_athlete_id uuid, p_snapshot jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare lease billing_private.customer_leases%rowtype; matched uuid;
begin
  -- Match claim's lock order (receipt, then customer lease) so a concurrent
  -- redelivery cannot deadlock the worker finishing that same receipt.
  perform 1 from billing_private.webhook_receipts
    where event_id = p_event_id and customer_id = p_customer_id for update;
  if not found then raise exception 'Webhook receipt missing'; end if;
  select * into lease from billing_private.customer_leases where customer_id = p_customer_id for update;
  if lease.lease_token is distinct from p_lease_token or lease.event_id is distinct from p_event_id
      or lease.expires_at <= clock_timestamp() then raise exception 'Billing lease expired'; end if;
  if p_athlete_id is not null and p_snapshot is not null then
    if p_snapshot->>'tier' is null or p_snapshot->>'tier' not in
      ('free', 'core', 'pro', 'coach_essentials', 'coach_pro', 'research', 'individual', 'coach') then
      raise exception 'Invalid subscription tier';
    end if;
    update public.athletes set
      stripe_customer_id = p_customer_id,
      stripe_subscription_id = p_snapshot->>'subscription_id',
      stripe_price_id = p_snapshot->>'price_id',
      stripe_subscription_status = p_snapshot->>'status',
      subscription_tier = p_snapshot->>'tier',
      subscription_activated_at = (p_snapshot->>'activated_at')::timestamptz
      where id = p_athlete_id and (stripe_customer_id is null or stripe_customer_id = p_customer_id)
      returning id into matched;
    if matched is null then raise exception 'Billing account ownership changed'; end if;
  end if;
  update billing_private.webhook_receipts set processed_at = clock_timestamp()
    where event_id = p_event_id and customer_id = p_customer_id;
  if not found then raise exception 'Webhook receipt missing'; end if;
  delete from billing_private.customer_leases where customer_id = p_customer_id and lease_token = p_lease_token;
end $$;

create or replace function public.release_billing_webhook(p_customer_id text, p_lease_token uuid)
returns void language sql security invoker set search_path = '' as $$
  delete from billing_private.customer_leases where customer_id = p_customer_id and lease_token = p_lease_token;
$$;
revoke all on function public.claim_billing_webhook(text,text,text) from public, anon, authenticated;
revoke all on function public.finish_billing_webhook(text,text,uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.release_billing_webhook(text,uuid) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook(text,text,text) to service_role;
grant execute on function public.finish_billing_webhook(text,text,uuid,uuid,jsonb) to service_role;
grant execute on function public.release_billing_webhook(text,uuid) to service_role;
commit;
