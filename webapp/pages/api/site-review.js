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
      const actor = await requireLiveAthleteId(req, res, client);
      if (!actor) return;
      let { data: reviewer, error: accessError } = await client.from('site_reviewers').select('athlete_id, role').eq('athlete_id', actor).maybeSingle();
      // An application release must not remove the existing owner's feedback
      // access while the separately approved workflow migration is pending.
      const legacy = ['42703', 'PGRST204'].includes(accessError?.code) && /\brole\b/i.test(accessError.message || '');
      if (legacy) ({ data: reviewer, error: accessError } = await client.from('site_reviewers').select('athlete_id').eq('athlete_id', actor).maybeSingle());
      if (accessError) throw accessError;
      if (!reviewer) return res.status(403).json({ error: 'Review mode is not enabled for this account.' });
      const canManage = reviewer.role === 'owner';
      if (req.method === 'GET') {
        if (req.query?.access === '1') return res.status(200).json({ enabled: true, canManage, actor, legacy });
        let query = client.from('site_review_notes').select(legacy ? '*' : '*, submitter:site_reviewers(display_name), history:site_review_events(id,actor_id,actor_name,status,message,created_at)');
        if (!canManage) query = query.eq('athlete_id', actor);
        const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
        if (error) throw error;
        return res.status(200).json({ notes: data || [], canManage, actor, legacy });
      }
      if (!req.headers['content-type']?.startsWith('application/json') || req.headers['sec-fetch-site'] === 'cross-site') {
        return res.status(403).json({ error: 'Same-site JSON request required.' });
      }
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Same-site request required.' });
      }
      const body = req.body || {};
      if (!isValidAthleteId(body.id)) return res.status(400).json({ error: 'Invalid task ID.' });
      if (legacy && req.method === 'PATCH') {
        if (!['open','resolved'].includes(body.status)) return res.status(400).json({ error: 'Task approval is not available until the reviewed migration is released.' });
        const { data, error } = await client.from('site_review_notes').update({ status: body.status }).eq('id',body.id).eq('athlete_id',actor).select('*').maybeSingle();
        if (error) throw error;
        return data ? res.status(200).json({ note: data }) : res.status(404).json({ error: 'Note not found.' });
      }
      let args;
      if (req.method === 'PATCH') {
        if (!['update', 'transition'].includes(body.action) || !isValidAthleteId(body.requestId) || !Number.isSafeInteger(body.version) || body.version < 1 || typeof body.message !== 'string' || body.message.length > 5000 || (body.action === 'update' && !body.message.trim())) {
          return res.status(400).json({ error: 'Enter a valid update and refresh the task before retrying.' });
        }
        if (body.action === 'transition' && !canManage) return res.status(403).json({ error: 'Only the owner can approve or change task status.' });
        if (body.action === 'transition' && !['pending_review','approved','in_progress','awaiting_acceptance','completed'].includes(body.status)) return res.status(400).json({ error: 'Invalid status.' });
        args = { p_request: body.requestId, p_action: body.action, p_version: body.version, p_status: body.action === 'transition' ? body.status : null, p_message: body.message.trim(), p_path: null, p_element: null, p_viewport: null };
      } else {
        const { pathname, element = '', viewport = '' } = body;
        const note = typeof body.note === 'string' ? body.note.trim() : '';
        if (!note || note.length > 5000 || typeof pathname !== 'string' || !/^\/(?!\/)[^?#\\\s]*$/.test(pathname) || pathname.length > 500 || typeof element !== 'string' || element.length > 1000 || typeof viewport !== 'string' || viewport.length > 40) {
          return res.status(400).json({ error: 'Enter a note (up to 5,000 characters) and a valid page path.' });
        }
        args = { p_request: body.id, p_action: 'submit', p_version: null, p_status: null, p_message: note, p_path: pathname, p_element: element, p_viewport: viewport };
        if (legacy) {
          const { error } = await client.from('site_review_notes').upsert({ id:body.id,athlete_id:actor,pathname,element,viewport,note }, { onConflict:'id',ignoreDuplicates:true });
          if (error) throw error;
          const { data: saved, error: readError } = await client.from('site_review_notes').select('*').eq('id',body.id).eq('athlete_id',actor).maybeSingle();
          if (readError) throw readError;
          if (!saved || saved.note !== note || saved.pathname !== pathname || saved.element !== element || saved.viewport !== viewport) return res.status(409).json({ error:'This retry differs from the saved note. Retry the original submission.' });
          return res.status(200).json({ saved:true,note:saved });
        }
      }
      // Actor always comes from the real signed, revocation-checked session, never body/view-as.
      const { data, error } = await client.rpc('write_site_review', { ...args, p_actor: actor, p_id: body.id });
      if (error) {
        const code = { '42501':403, '40001':409, '22023':400, 'P0002':404 }[error.code];
        if (code) return res.status(code).json({ error: code === 409 ? 'This task changed or this retry differs. Refresh and review it before trying again.' : code === 403 ? 'You cannot change this task.' : code === 404 ? 'Task not found.' : 'This task change is not allowed.' });
        throw error;
      }
      return res.status(200).json({ saved: true, note: data });
    } catch {
      return res.status(503).json({ error: 'Feedback tasks are temporarily unavailable. Your draft is still here; please retry.' });
    }
  };
}
export default createSiteReviewHandler();
