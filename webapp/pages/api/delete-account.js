import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

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

  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { confirm } = req.body || {};
  if (confirm !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({ error: 'Confirmation text did not match.' });
  }

  // Delete in dependency order so foreign keys don't block us.
  // The schema uses athlete_id columns on these tables.
  const tables = [
    'interventions',
    'workout_check_ins',
    'athlete_settings',
    'races',
    'race_outcomes',
    'invites',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('athlete_id', athleteId);
    // Ignore "relation does not exist" errors — some tables may not be created yet
    if (error && !error.message.includes('does not exist')) {
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

  // Clear the session cookie
  res.setHeader(
    'Set-Cookie',
    cookie.serialize('athlete_id', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );

  return res.status(200).json({ success: true });
}
