import { clearAthleteCookie, getAthleteIdFromRequest, getSupabaseAdminClient } from '../../lib/authServer';

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    message.includes('does not exist') ||
    message.includes('could not find the table')
  );
}

/**
 * DELETE /api/delete-account
 *
 * Permanently deletes the authenticated athlete's account and all
 * associated data (interventions, settings, races, race outcomes).
 * Clears the session cookie on success.
 *
 * Requires a confirmation body: { confirm: 'DELETE MY ACCOUNT' }
 */
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const athleteId = getAthleteIdFromRequest(req);
  const supabase = getSupabaseAdminClient();
  if (!athleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { confirm } = req.body || {};
  if (confirm !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({ error: 'Confirmation text did not match.' });
  }

  const { data: athlete, error: athleteLookupError } = await supabase
    .from('athletes')
    .select('id, supabase_user_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteLookupError) {
    return res.status(500).json({ error: `Failed to load account: ${athleteLookupError.message}` });
  }

  // Delete in dependency order so foreign keys don't block us.
  // The schema uses athlete_id columns on these tables.
  const tables = [
    'activity_follow_up_prompts',
    'activity_events',
    'provider_connections',
    'strava_activities',
    'interventions',
    'workout_check_ins',
    'athlete_settings',
    'athlete_supplements',
    'races',
    'race_outcomes',
    'user_notifications',
    'invites',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('athlete_id', athleteId);
    // Ignore missing optional tables because beta databases can lag migrations.
    if (error && !isMissingTableError(error)) {
      console.error(`Error deleting from ${table}:`, error.message);
      return res.status(500).json({ error: `Failed to delete data from ${table}: ${error.message}` });
    }
  }

  // Finally delete the athlete row itself
  const { error: athleteError } = await supabase.from('athletes').delete().eq('id', athleteId);
  if (athleteError) {
    console.error('Error deleting athlete:', athleteError.message);
    return res.status(500).json({ error: `Failed to delete account: ${athleteError.message}` });
  }

  if (athlete?.supabase_user_id) {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(athlete.supabase_user_id);
    if (authDeleteError && !String(authDeleteError.message || '').toLowerCase().includes('not found')) {
      console.error('Error deleting Supabase Auth user:', authDeleteError.message);
      return res.status(500).json({ error: `Deleted athlete data but failed to delete login user: ${authDeleteError.message}` });
    }
  }

  // Clear the session cookie
  clearAthleteCookie(res);

  return res.status(200).json({ success: true });
}
