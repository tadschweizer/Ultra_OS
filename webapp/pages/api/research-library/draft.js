import cookie from 'cookie';
import { buildResearchDraft } from '../../../lib/researchDrafts';

export default function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;

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
