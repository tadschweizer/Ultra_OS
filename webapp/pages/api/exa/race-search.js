import { searchRaces } from '../../../lib/exa';
import { getAthleteIdFromRequest } from '../../../lib/auth/sessionCookies.js';

export default async function handler(req, res) {
  if (!getAthleteIdFromRequest(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  const requestedNum = parseInt(req.query.num, 10);
  const numResults = Number.isFinite(requestedNum) ? Math.min(Math.max(requestedNum, 1), 20) : 10;

  try {
    const races = await searchRaces(q, { numResults });
    res.status(200).json({ races });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Race search failed' });
  }
}
