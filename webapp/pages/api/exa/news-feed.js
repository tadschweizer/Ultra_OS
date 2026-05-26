import cookie from 'cookie';
import { fetchNewsFeed } from '../../../lib/exa';

const ALLOWED_SPORTS = new Set(['running', 'ultramarathon', 'cycling', 'triathlon', 'biking', 'swimming']);

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  if (!cookies.athlete_id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const sport = typeof req.query.sport === 'string' ? req.query.sport.trim().toLowerCase() : '';
  if (!sport || !ALLOWED_SPORTS.has(sport)) {
    res.status(400).json({
      error: `Query parameter sport is required. Allowed values: ${[...ALLOWED_SPORTS].join(', ')}`,
    });
    return;
  }

  const requestedNum = parseInt(req.query.num, 10);
  const numResults = Number.isFinite(requestedNum) ? Math.min(Math.max(requestedNum, 1), 20) : 10;

  try {
    const news = await fetchNewsFeed(sport, { numResults });
    res.status(200).json({ news });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'News feed fetch failed' });
  }
}
