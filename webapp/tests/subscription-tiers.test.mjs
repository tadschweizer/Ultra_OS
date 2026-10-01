import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMING_SOON_FEATURES,
  TIER_FEATURES,
  buildUsageSnapshot,
  canAccessExplorer,
  canAccessFullInsights,
  canAccessRaceBlueprint,
  canLogCheckIn,
  canLogIntervention,
  getFeatureList,
  getIncludedAthletes,
  getSubscriptionTierLabel,
  hasFeature,
  isCoachTier,
  normalizeSubscriptionTier,
} from '../lib/subscriptionTiers.js';
import { loadCheckInEntitlement } from '../lib/pilotEntitlementsServer.js';
import { buildAccountAccess, canCreateCoachProfile } from '../lib/auth/roleGuards.js';
import { fixedNow, pilotDb } from './helpers/pilotDb.mjs';

const as = (tier) => ({ subscription_tier: tier });

test('legacy tiers map forward to at least what the subscriber paid for', () => {
  assert.equal(normalizeSubscriptionTier('research'), 'core');
  assert.equal(normalizeSubscriptionTier('research_feed'), 'core');
  assert.equal(normalizeSubscriptionTier('individual'), 'pro');
  assert.equal(normalizeSubscriptionTier('coach'), 'coach_pro');
  assert.equal(normalizeSubscriptionTier(' PRO '), 'pro');
  assert.equal(normalizeSubscriptionTier('platinum'), 'free');
  assert.equal(normalizeSubscriptionTier(null), 'free');
  assert.equal(getSubscriptionTierLabel('individual'), 'Athlete Pro');
});

test('each tier strictly includes the tier below it', () => {
  const includes = (upper, lower) => TIER_FEATURES[lower].every((feature) => TIER_FEATURES[upper].includes(feature));
  assert.ok(includes('core', 'free'));
  assert.ok(includes('pro', 'core'));
  assert.ok(includes('coach_essentials', 'core'));
  assert.ok(includes('coach_pro', 'coach_essentials'));
  assert.ok(includes('coach_pro', 'pro'));
});

test('free gets trackers only; core adds trends; pro adds advanced analytics', () => {
  assert.deepEqual(getFeatureList('free'), []);
  assert.ok(hasFeature(as('core'), 'volume_trends'));
  assert.ok(!hasFeature(as('core'), 'fitness_fatigue'));
  for (const feature of ['fitness_fatigue', 'steady_state_analysis', 'training_correlations', 'explorer', 'race_blueprint']) {
    assert.ok(hasFeature(as('pro'), feature), feature);
    assert.ok(!hasFeature(as('core'), feature), feature);
  }
  assert.equal(canAccessFullInsights(as('core')).allowed, false);
  assert.equal(canAccessFullInsights(as('individual')).allowed, true);
  assert.equal(canAccessExplorer(as('pro')).allowed, true);
  assert.equal(canAccessRaceBlueprint(as('free')).allowed, false);
});

test('coach essentials hides advanced metrics; coach pro includes them', () => {
  assert.ok(hasFeature(as('coach_essentials'), 'coach_workspace'));
  assert.ok(!hasFeature(as('coach_essentials'), 'coach_advanced_metrics'));
  assert.ok(!hasFeature(as('coach_essentials'), 'fitness_fatigue'));
  assert.ok(hasFeature(as('coach_pro'), 'coach_advanced_metrics'));
  assert.ok(hasFeature(as('coach'), 'coach_advanced_metrics'));
  assert.equal(getIncludedAthletes('coach_essentials'), 10);
  assert.equal(getIncludedAthletes('coach_pro'), 25);
  assert.equal(getIncludedAthletes('pro'), null);
  assert.ok(isCoachTier('coach'));
  assert.ok(!isCoachTier('pro'));
});

test('AI features are announced but granted to no tier', () => {
  for (const feature of COMING_SOON_FEATURES) {
    for (const tier of Object.keys(TIER_FEATURES)) {
      assert.ok(!hasFeature(as(tier), feature, { linkedToPaidCoach: true, coachPilot: true }), `${tier}:${feature}`);
    }
  }
});

test('paid-coach link grants Core; pilot grant adds coach tools only', () => {
  const linked = { linkedToPaidCoach: true };
  assert.ok(hasFeature(as('free'), 'volume_trends', linked));
  assert.ok(!hasFeature(as('free'), 'fitness_fatigue', linked));
  assert.equal(canLogIntervention(as('free'), 15).allowed, false);
  assert.equal(canLogIntervention(as('free'), 15, linked).allowed, true);
  assert.equal(buildUsageSnapshot({ athlete: as('free'), interventionCount: 20, featureOptions: linked }).interventionsLimit, null);

  const pilot = { coachPilot: true };
  assert.ok(hasFeature(as('free'), 'coach_advanced_metrics', pilot));
  assert.ok(!hasFeature(as('free'), 'race_blueprint', pilot));
  assert.ok(!hasFeature(as('free'), 'unlimited_interventions', pilot));
});

test('check-in caps: free capped, paid uncapped, lapsed paid capped when entitlement says so', () => {
  assert.equal(canLogCheckIn(as('free'), 3).allowed, false);
  assert.equal(canLogCheckIn(as('core'), 30).allowed, true);
  assert.equal(canLogCheckIn(as('pro'), 30, { unlimited: false, source: 'own_plan' }).allowed, false);
  assert.equal(canLogCheckIn(as('free'), 30, { unlimited: true, source: 'pilot_coach' }).allowed, true);
});

test('entitlement lookup: paid coach link grants Core, pilot link does not', async () => {
  const paid = pilotDb({ pilot: false, coachTier: 'coach_essentials' });
  const paidAccess = await loadCheckInEntitlement(paid, paid.tables.athletes[0], fixedNow);
  assert.equal(paidAccess.unlimited, true);
  assert.equal(paidAccess.linkedToPaidCoach, true);
  assert.equal(paidAccess.source, 'paid_coach');

  const legacyPaid = pilotDb({ pilot: false, coachTier: 'coach' });
  assert.equal((await loadCheckInEntitlement(legacyPaid, legacyPaid.tables.athletes[0], fixedNow)).linkedToPaidCoach, true);

  const pilot = pilotDb();
  const pilotAccess = await loadCheckInEntitlement(pilot, pilot.tables.athletes[0], fixedNow);
  assert.equal(pilotAccess.unlimited, true);
  assert.equal(pilotAccess.linkedToPaidCoach, false);

  const none = pilotDb({ pilot: false });
  assert.equal((await loadCheckInEntitlement(none, none.tables.athletes[0], fixedNow)).linkedToPaidCoach, false);
});

test('both coach tiers count as paid coach capability', () => {
  const profile = { id: 'coach-profile' };
  for (const tier of ['coach_essentials', 'coach_pro', 'coach']) {
    const access = buildAccountAccess({ athlete: { id: 'a', subscription_tier: tier }, coachProfile: profile });
    assert.equal(access.capabilities.paidCoach, true, tier);
    assert.equal(canCreateCoachProfile({ athlete: { subscription_tier: tier, onboarding_complete: true }, primaryRole: 'athlete' }), true);
  }
  assert.equal(canCreateCoachProfile({ athlete: { subscription_tier: 'pro', onboarding_complete: true }, primaryRole: 'athlete' }), false);
});
