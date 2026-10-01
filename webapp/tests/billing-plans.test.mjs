import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBillingPriceId,
  getPublicCheckoutPath,
  getTierFromPriceId,
  getTierFromSubscription,
  normalizeStripePriceId,
} from '../lib/billingPlans.js';

function withEnv(key, value, fn) {
  const original = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;

  try {
    fn();
  } finally {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
}

test('Stripe price ids are trimmed before checkout and tier lookup', () => {
  withEnv('STRIPE_PRICE_COACH_ANNUAL', 'price_1TJOozLs6h9nimdMy7EuSdY0\r\n', () => {
    assert.equal(normalizeStripePriceId(process.env.STRIPE_PRICE_COACH_ANNUAL), 'price_1TJOozLs6h9nimdMy7EuSdY0');
    assert.equal(getBillingPriceId('coach_annual'), 'price_1TJOozLs6h9nimdMy7EuSdY0');
    // The legacy Coach price maps forward to Coach Pro.
    assert.equal(getTierFromPriceId('price_1TJOozLs6h9nimdMy7EuSdY0\r\n'), 'coach_pro');
  });
});

test('public signup resumes only current athlete checkout plans', () => {
  for (const plan of ['core_monthly', 'core_annual', 'pro_monthly', 'pro_annual']) {
    assert.equal(getPublicCheckoutPath(plan), `/api/billing/checkout?plan=${plan}`);
  }
  for (const plan of ['coach_essentials_monthly', 'coach_pro_annual', 'coach_monthly']) {
    assert.equal(getPublicCheckoutPath(plan), null);
  }
  // Legacy plans are no longer sold.
  for (const plan of ['individual_annual', 'individual_monthly', 'research_monthly']) {
    assert.equal(getPublicCheckoutPath(plan), null);
  }
  assert.equal(getPublicCheckoutPath('unknown'), null);
});

test('legacy subscriptions resolve to their successor tiers', () => {
  assert.equal(getTierFromPriceId('price_1TG9MNLs6h9nimdMijXTxWpC'), 'pro');
  assert.equal(getTierFromPriceId('price_1TG9MOLs6h9nimdMmgLvmC23'), 'pro');
  assert.equal(getTierFromSubscription({ metadata: { subscription_tier: 'individual' } }), 'pro');
  assert.equal(getTierFromSubscription({ metadata: { subscription_tier: 'research' } }), 'core');
  assert.equal(getTierFromSubscription({ metadata: { subscription_tier: 'coach' } }), 'coach_pro');
  assert.equal(getTierFromSubscription({ metadata: { subscription_tier: 'coach_essentials' } }), 'coach_essentials');
  assert.equal(getTierFromSubscription({ metadata: { subscription_tier: 'bogus' } }), 'free');
});

test('new plan prices resolve to their tiers', () => {
  withEnv('STRIPE_PRICE_CORE_ANNUAL', 'price_core_annual', () => {
    assert.equal(getBillingPriceId('core_annual'), 'price_core_annual');
    assert.equal(getTierFromPriceId('price_core_annual'), 'core');
  });
  withEnv('STRIPE_PRICE_COACH_ESSENTIALS_MONTHLY', 'price_ce_monthly', () => {
    assert.equal(getTierFromPriceId('price_ce_monthly'), 'coach_essentials');
  });
});
