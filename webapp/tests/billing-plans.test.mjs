import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBillingPriceId,
  getTierFromPriceId,
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
    assert.equal(getTierFromPriceId('price_1TJOozLs6h9nimdMy7EuSdY0\r\n'), 'coach');
  });
});
