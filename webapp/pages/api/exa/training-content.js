import cookie from 'cookie';
import { searchTrainingContent } from '../../../lib/exa';

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

  const sport = typeof req.query.sport === 'string' ? req.query.sport.trim() : '';
  if (!sport) {
    res.status(400).json({ error: 'Query parameter sport is required' });
    return;
  }

  const distance = typeof req.query.distance === 'string' ? req.query.distance.trim() : '';
  const topic = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';

  try {
    const articles = await searchTrainingContent(sport, distance, topic);
    res.status(200).json({ articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Training content search failed' });
  }
}
