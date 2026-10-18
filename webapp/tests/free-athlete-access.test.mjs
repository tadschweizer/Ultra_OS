import test from 'node:test';
import assert from 'node:assert/strict';
import { getFeatureList, canLogCheckIn, canLogIntervention, buildUsageSnapshot } from '../lib/subscriptionTiers.js';
import { hasActivePilot, coachEntitlement, hasPaidAccess } from '../lib/pilotEntitlements.js';
import { loadCheckInEntitlement } from '../lib/pilotEntitlementsServer.js';
import { applyComplimentaryAccess } from '../lib/complimentaryAccessServer.js';
import { createBillingFlowHandler } from '../lib/billingFlow.js';

test('open athlete access removes caps but grants no coach or deferred features; switching off restores tiers', async () => {
  const original = process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS;
  try {
    process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS = 'true';
    const athlete = { id: 'athlete', subscription_tier: 'free' };
    const features = getFeatureList('free');
    for (const feature of ['volume_trends', 'fitness_fatigue', 'explorer', 'steady_state_analysis', 'training_correlations']) assert.ok(features.includes(feature));
    for (const feature of ['coach_workspace', 'coach_advanced_metrics', 'ai_analysis', 'coach_ai']) assert.ok(!features.includes(feature));
    assert.equal(coachEntitlement({ athlete, profile: { id: 'coach' } }).eligible, false);
    assert.equal(canLogCheckIn({ ...athlete, subscription_tier: 'pro' }, 100, { unlimited: false }).allowed, true);
    assert.equal(canLogIntervention(athlete, 100).allowed, true);
    assert.equal(buildUsageSnapshot({ athlete, interventionCount: 100, weeklyCheckIns: 100 }).weeklyCheckInsLimit, null);
    assert.equal((await loadCheckInEntitlement({}, athlete)).source, 'open_access');
    process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS = 'false';
    assert.deepEqual(getFeatureList('free'), []);
    assert.equal(canLogIntervention(athlete, 100).allowed, false);
    assert.equal(canLogCheckIn(athlete, 100).allowed, false);
  } finally { if (original === undefined) delete process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS; else process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS = original; }
});

test('open access rejects checkout and preview before any payment call', async () => {
  const original = process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS;
  try {
    process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS = 'true';
    for (const [action, method] of [['checkout', 'GET'], ['checkout', 'POST'], ['preview', 'GET']]) {
      const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await createBillingFlowHandler(action, { getClient() { throw new Error('unexpected database call'); }, getStripe() { throw new Error('unexpected payment call'); } })({ method }, res);
      assert.equal(res.code, 403); assert.equal(res.body.code, 'ATHLETE_OPEN_ACCESS');
    }
  } finally { if (original === undefined) delete process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS; else process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS = original; }
});

test('permanent athlete grant trusts confirmed Auth email, never profile email or metadata', async () => {
  process.env.COMPLIMENTARY_ATHLETE_EMAILS = 'reserved@example.test';
  try {
    const athlete = { id: 'athlete', supabase_user_id: 'auth-user', subscription_tier: 'free', email: 'reserved@example.test' };
    const lookup = user => ({ auth: { admin: { async getUserById(id) { assert.equal(id, 'auth-user'); return { data: { user } }; } } } });
    for (const user of [{ email: 'reserved@example.test' }, { email: 'other@example.test', email_confirmed_at: '2026-01-01', user_metadata: { email: 'reserved@example.test' } }]) {
      assert.equal((await applyComplimentaryAccess(lookup(user), athlete)).subscription_tier, 'free');
    }
    const granted = await applyComplimentaryAccess(lookup({ email: 'RESERVED@example.test', email_confirmed_at: '2026-01-01' }), athlete);
    assert.equal(granted.subscription_tier, 'pro'); assert.equal(granted.complimentary_access, true);
    assert.equal(athlete.subscription_tier, 'free');
    assert.equal((await applyComplimentaryAccess({}, { subscription_tier: 'free' })).subscription_tier, 'free');
    await assert.rejects(applyComplimentaryAccess(lookup(null), athlete));
  } finally { delete process.env.COMPLIMENTARY_ATHLETE_EMAILS; }
});

test('permanent coach approval has no expiry but still honors start and revocation', () => {
  const grant = { starts_at: '2026-01-01', expires_at: 'infinity', revoked_at: null };
  assert.equal(hasActivePilot(grant, new Date('2126-01-01')), true);
  assert.equal(hasActivePilot({ ...grant, revoked_at: '2026-02-01' }), false);
  assert.equal(hasActivePilot({ ...grant, starts_at: '2126-01-01' }), false);
  assert.equal(hasActivePilot({ ...grant, expires_at: 'garbage' }), false);
});


test('complimentary athlete access never revives a canceled coach subscription', async () => {
  const athlete = { id: 'former-coach', subscription_tier: 'coach_pro', stripe_subscription_id: 'sub_old', stripe_subscription_status: 'canceled', complimentary_access: true };
  assert.equal(hasPaidAccess(athlete, ['coach_pro']), false);
  assert.equal(coachEntitlement({ athlete, profile: { id: 'coach' } }).eligible, false);
  assert.equal((await loadCheckInEntitlement({}, athlete)).unlimited, true);
  assert.ok(getFeatureList('coach_essentials', { complimentaryAthlete: true }).includes('steady_state_analysis'));
});
