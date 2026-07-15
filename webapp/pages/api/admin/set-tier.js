import { createClient } from '@supabase/supabase-js';
import { requireAdminAthleteId } from '../../../lib/auth/requireAthlete.js';
import { isValidAthleteId } from '../../../lib/auth/contracts.js';
import { canOverrideTier, isKnownTier } from '../../../lib/adminDemo.js';

/**
 * POST /api/admin/set-tier { athleteId, tier } — admin-only manual override
 * of an athlete's subscription_tier (free/research/individual/coach) without
 * going through Stripe. Refused for accounts whose tier is owned by an
 * active Stripe subscription (the billing webhook would revert it).
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role config');
  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getAdminClient();
  const adminId = await requireAdminAthleteId(req, res, supabase);
  if (!adminId) return;

  const { athleteId, tier } = req.body || {};
  if (!isValidAthleteId(athleteId)) return res.status(400).json({ error: 'A valid athleteId is required' });
  if (!isKnownTier(tier)) return res.status(400).json({ error: 'Unknown tier' });

  const { data: target, error } = await supabase
    .from('athletes')
    .select('id, subscription_tier, stripe_subscription_id, stripe_subscription_status')
    .eq('id', athleteId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!target) return res.status(404).json({ error: 'Athlete not found' });

  const gate = canOverrideTier(target);
  if (!gate.allowed) return res.status(409).json({ error: gate.reason });

  const { error: updateError } = await supabase
    .from('athletes')
    .update({
      subscription_tier: tier,
      subscription_activated_at: tier === 'free' ? null : new Date().toISOString(),
    })
    .eq('id', athleteId);
  if (updateError) return res.status(500).json({ error: updateError.message });

  console.log(`[admin] ${adminId} set tier of ${athleteId}: ${target.subscription_tier} → ${tier}`);
  return res.status(200).json({ ok: true, athleteId, tier });
}
