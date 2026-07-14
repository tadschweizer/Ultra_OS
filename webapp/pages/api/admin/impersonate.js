import { createClient } from '@supabase/supabase-js';
import { requireAdminAthleteId } from '../../../lib/auth/requireAthlete.js';
import { clearViewAsCookie, setViewAsCookie } from '../../../lib/auth/sessionCookies.js';
import { isValidAthleteId } from '../../../lib/auth/contracts.js';

/**
 * POST /api/admin/impersonate { athleteId } — start read-only impersonation
 * (sets the signed, httpOnly `view_as` cookie, 2h max).
 * DELETE /api/admin/impersonate — stop.
 * Admin-only for POST; DELETE only requires a session so a demoted admin can
 * always clear a lingering cookie.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role config');
  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    clearViewAsCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getAdminClient();
  const adminId = await requireAdminAthleteId(req, res, supabase);
  if (!adminId) return;

  const targetId = req.body?.athleteId;
  if (!isValidAthleteId(targetId)) return res.status(400).json({ error: 'A valid athleteId is required' });
  if (targetId === adminId) return res.status(400).json({ error: 'You are already viewing your own account' });

  const { data: target, error } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', targetId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!target) return res.status(404).json({ error: 'Athlete not found' });

  setViewAsCookie(res, targetId);
  return res.status(200).json({ ok: true, viewingAs: { athleteId: target.id, name: target.name } });
}
