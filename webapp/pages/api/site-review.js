import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { requireLiveAthleteId } from '../../lib/auth/requireAthlete.js';
import { isValidAthleteId } from '../../lib/auth/contracts.js';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export function createSiteReviewHandler({ getClient = getSupabaseAdminClient } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const client = getClient();
      // Always use the real, revocation-checked session, never the view-as identity.
      const owner = await requireLiveAthleteId(req, res, client);
      if (!owner) return;
      const { data: reviewer, error: accessError } = await client.from('site_reviewers').select('athlete_id').eq('athlete_id', owner).maybeSingle();
      if (accessError) throw accessError;
      if (!reviewer) return res.status(403).json({ error: 'Review mode is not enabled for this account.' });
      if (req.method === 'GET') {
        if (req.query?.access === '1') return res.status(200).json({ enabled: true });
        const { data, error } = await client.from('site_review_notes').select('*').eq('athlete_id', owner).order('created_at', { ascending: false }).limit(1000);
        if (error) throw error;
        return res.status(200).json({ notes: data || [] });
      }
      if (!req.headers['content-type']?.startsWith('application/json') || req.headers['sec-fetch-site'] === 'cross-site') {
        return res.status(403).json({ error: 'Same-site JSON request required.' });
      }
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Same-site request required.' });
      }
      const body = req.body || {};
      if (!isValidAthleteId(body.id)) return res.status(400).json({ error: 'Invalid note ID.' });
      if (req.method === 'PATCH') {
        if (!['open', 'resolved'].includes(body.status)) return res.status(400).json({ error: 'Invalid status.' });
        const { data, error } = await client.from('site_review_notes').update({ status: body.status }).eq('id', body.id).eq('athlete_id', owner).select('*').maybeSingle();
        if (error) throw error;
        return data ? res.status(200).json({ note: data }) : res.status(404).json({ error: 'Note not found.' });
      }
      const { pathname, element = '', viewport = '' } = body;
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (!note || note.length > 5000 || typeof pathname !== 'string' || !/^\/(?!\/)[^?#\\\s]*$/.test(pathname) || pathname.length > 500 || typeof element !== 'string' || element.length > 1000 || typeof viewport !== 'string' || viewport.length > 40) {
        return res.status(400).json({ error: 'Enter a note (up to 5,000 characters) and a valid page path.' });
      }
      // Client-generated UUID makes retry after a lost response safe.
      const { error } = await client.from('site_review_notes').upsert({ id: body.id, athlete_id: owner, pathname, element, viewport, note }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
      return res.status(200).json({ saved: true });
    } catch {
      return res.status(503).json({ error: 'Review notes are temporarily unavailable. Your draft is still here; please retry.' });
    }
  };
}
export default createSiteReviewHandler();
