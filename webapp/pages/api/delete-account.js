import { getAthleteByCookie, getSupabaseAdminClient } from '../../lib/authServer.js';
import { getStripeClient } from '../../lib/stripeServer.js';
import { clearAthleteCookie, getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';

/**
 * DELETE /api/delete-account
 *
 * Removes the authenticated athlete's account and the records covered by
 * this cleanup/cascade workflow. Stops linked billing first and reports
 * partial external sign-in cleanup. Storage objects/backups are separate.
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
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code)
    || /does not exist/i.test(error?.message || '');
}

export function createDeleteAccountHandler({ getClient = getSupabaseAdminClient, getAthlete = getAthleteByCookie, getStripe = getStripeClient } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
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

  let admin;
  let authenticated;
  try {
    if (!requireSameOriginJson(req, res, 'DELETE')) return;
    admin = getClient();
    authenticated = await getAthlete(req, admin);
  }
  catch { return res.status(503).json({ error: 'Could not verify your account. Please retry.' }); }
  if (!authenticated || authenticated.id !== athleteId) return res.status(401).json({ error: 'Please log in again before deleting your account.' });

  // Capture identity links before the row disappears.
  const { data: athlete, error: athleteLookupError } = await admin
    .from('athletes')
    .select('id, supabase_user_id, stripe_customer_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteLookupError) {
    return res.status(503).json({ error: 'Could not verify your account. Please retry.' });
  }
  if (!athlete) {
    clearAthleteCookie(res);
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // 1. Stripe: cancel subscriptions and delete the customer so billing
  // stops. Never delete the account while continuing to bill its owner.
  let stripeCleanup = 'skipped';
  if (athlete.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const subscriptions = await stripe.subscriptions.list({
        customer: athlete.stripe_customer_id,
        status: 'all',
        limit: 100,
      });
      if (subscriptions.has_more) throw new Error('Incomplete subscription lookup');
      for (const sub of subscriptions.data) {
        if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
          await stripe.subscriptions.cancel(sub.id);
        }
      }
      await stripe.customers.del(athlete.stripe_customer_id);
      stripeCleanup = 'done';
    } catch (stripeError) {
      if (stripeError?.code === 'resource_missing' && stripeError?.param === 'customer') {
        stripeCleanup = 'done';
      } else {
        console.error('[delete-account] Stripe cleanup failed:', { code: stripeError?.code });
        return res.status(503).json({ error: 'We could not stop billing, so your account has not been deleted. Retry or contact support.' });
      }
    }
  }

  // 2. invites.created_by / used_by reference athletes with NO ON DELETE
  // clause — the athlete row deletion would fail while they point at it.
  for (const column of ['created_by', 'used_by']) {
    const { error } = await admin.from('invites').update({ [column]: null }).eq(column, athleteId);
    if (error && !isMissingSchemaError(error)) {
      console.error(`[delete-account] Failed clearing invites.${column}:`, { code: error.code });
      return res.status(503).json({ error: 'Could not finish account deletion. Please retry or contact support.' });
    }
  }

  // 3. Tables whose rows would otherwise survive as orphans.
  for (const [table, column] of ORPHAN_DELETIONS) {
    const { error } = await admin.from(table).delete().eq(column, athleteId);
    if (error && !isMissingSchemaError(error)) {
      console.error(`[delete-account] Error deleting from ${table}:`, { code: error.code });
      return res.status(503).json({ error: 'Could not finish account deletion. Please retry or contact support.' });
    }
  }

  // 4. Delete the athlete row. ON DELETE CASCADE removes interventions,
  // races, settings, supplements, planned workouts, calendar notes,
  // notifications, import jobs, relationships, and the coach profile
  // with all coach-owned rows.
  const { error: athleteError } = await admin.from('athletes').delete().eq('id', athleteId);
  if (athleteError) {
    console.error('[delete-account] Error deleting athlete:', { code: athleteError.code });
    return res.status(503).json({ error: 'Could not finish account deletion. Please contact support.' });
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
      console.error('[delete-account] Auth user deletion failed:', { code: authDeleteError?.code });
      authCleanup = 'failed';
    }
  }

  clearAthleteCookie(res);

  return res.status(200).json({
    success: true,
    stripe_cleanup: stripeCleanup,
    auth_cleanup: authCleanup,
  });
};
}

export default createDeleteAccountHandler();
