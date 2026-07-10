import { buildResearchDraft } from '../../../lib/researchDrafts';
import { getAthleteIdFromRequest } from '../../../lib/auth/sessionCookies.js';

export default function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);

  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const body = req.body || {};
  if (!body.title) {
    res.status(400).json({ error: 'Title is required before generating a draft.' });
    return;
  }

  res.status(200).json({ draft: buildResearchDraft(body) });
}
