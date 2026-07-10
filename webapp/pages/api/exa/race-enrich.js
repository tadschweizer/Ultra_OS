import { enrichRace } from '../../../lib/exa';
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

  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'Query parameter name is required' });
    return;
  }

  const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';

  try {
    const results = await enrichRace(name, location);
    res.status(200).json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Race enrichment failed' });
  }
}
