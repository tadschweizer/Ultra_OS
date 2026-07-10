import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { getStripeClient } from '../../lib/stripeServer.js';
import { clearAthleteCookie, getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';

/**
 * DELETE /api/delete-account
 *
 * Permanently deletes the authenticated athlete's account and all
 * associated data: every athlete-owned table, the Supabase auth user,
 * and the Stripe customer/subscription. Clears the session cookie.
 *
 * Requires a confirmation body: { confirm: 'DELETE MY ACCOUNT' }
 *
 * Most tables cascade from the athletes row (athlete_id ... ON DELETE
 * CASCADE), including the coach_profiles row and everything hanging off
 * it (templates, plans, groups, messages, notes). The explicit work here
 * covers the tables that do NOT cascade cleanly.
 */

// Tables whose FK is ON DELETE SET NULL (or missing entirely), so rows
// would survive as orphans. Deleted explicitly by athlete column.
// Each entry is [table, column]. Errors about missing tables/columns are
// tolerated because local and production schemas can drift.
export const ORPHAN_DELETIONS = [
  ['attachments', 'owner_athlete_id'],
  ['coros_activities', 'athlete_id'],
  ['integration_interest', 'athlete_id'],
  // Not in the migrations (created directly in production), cascade unknown:
  ['activities', 'athlete_id'],
  // Legacy tables kept from the previous implementation:
  ['workout_check_ins', 'athlete_id'],
  ['race_outcomes', 'athlete_id'],
];

function isMissingSchemaError(error) {
  return /does not exist/i.test(error?.message || '');
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { confirm } = req.body || {};
  if (confirm !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({ error: 'Confirmation text did not match.' });
  }

  const admin = getSupabaseAdminClient();

  // Capture identity links before the row disappears.
  const { data: athlete, error: athleteLookupError } = await admin
    .from('athletes')
    .select('id, supabase_user_id, stripe_customer_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteLookupError) {
    return res.status(500).json({ error: athleteLookupError.message });
  }
  if (!athlete) {
    clearAthleteCookie(res);
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // 1. Stripe: cancel subscriptions and delete the customer so billing
  // stops. Best-effort — data deletion proceeds even if Stripe fails.
  let stripeCleanup = 'skipped';
  if (athlete.stripe_customer_id) {
    try {
      const stripe = getStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: athlete.stripe_customer_id,
        status: 'all',
        limit: 100,
      });
      for (const sub of subscriptions.data) {
        if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
          await stripe.subscriptions.cancel(sub.id);
        }
      }
      await stripe.customers.del(athlete.stripe_customer_id);
      stripeCleanup = 'done';
    } catch (stripeError) {
      console.error('[delete-account] Stripe cleanup failed:', stripeError?.message || stripeError);
      stripeCleanup = 'failed';
    }
  }

  // 2. invites.created_by / used_by reference athletes with NO ON DELETE
  // clause — the athlete row deletion would fail while they point at it.
  for (const column of ['created_by', 'used_by']) {
    const { error } = await admin.from('invites').update({ [column]: null }).eq(column, athleteId);
    if (error && !isMissingSchemaError(error)) {
      console.error(`[delete-account] Failed clearing invites.${column}:`, error.message);
      return res.status(500).json({ error: `Failed to detach invites: ${error.message}` });
    }
  }

  // 3. Tables whose rows would otherwise survive as orphans.
  for (const [table, column] of ORPHAN_DELETIONS) {
    const { error } = await admin.from(table).delete().eq(column, athleteId);
    if (error && !isMissingSchemaError(error)) {
      console.error(`[delete-account] Error deleting from ${table}:`, error.message);
      return res.status(500).json({ error: `Failed to delete data from ${table}: ${error.message}` });
    }
  }

  // 4. Delete the athlete row. ON DELETE CASCADE removes interventions,
  // races, settings, supplements, planned workouts, calendar notes,
  // notifications, import jobs, relationships, and the coach profile
  // with all coach-owned rows.
  const { error: athleteError } = await admin.from('athletes').delete().eq('id', athleteId);
  if (athleteError) {
    console.error('[delete-account] Error deleting athlete:', athleteError.message);
    return res.status(500).json({ error: `Failed to delete account: ${athleteError.message}` });
  }

  // 5. Supabase auth user (email/Google logins). Best-effort: the data is
  // already gone; a dangling auth user cannot reach anything.
  let authCleanup = 'skipped';
  if (athlete.supabase_user_id) {
    try {
      const { error: authError } = await admin.auth.admin.deleteUser(athlete.supabase_user_id);
      if (authError) throw authError;
      authCleanup = 'done';
    } catch (authDeleteError) {
      console.error('[delete-account] Auth user deletion failed:', authDeleteError?.message || authDeleteError);
      authCleanup = 'failed';
    }
  }

  clearAthleteCookie(res);

  return res.status(200).json({
    success: true,
    stripe_cleanup: stripeCleanup,
    auth_cleanup: authCleanup,
  });
}
