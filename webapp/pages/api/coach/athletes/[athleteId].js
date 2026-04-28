import { getCoachAthleteDetailData } from '../../../../lib/coachAthleteDetail';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const athleteId = typeof req.query.athleteId === 'string' ? req.query.athleteId : null;
    if (!athleteId) {
      res.status(400).json({ error: 'athleteId is required' });
      return;
    }

    const detail = await getCoachAthleteDetailData({ req, athleteId });

    if (!detail.authenticated) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!detail.authorized) {
      res.status(404).json({ error: 'Athlete not found in this coach roster.' });
      return;
    }

    res.status(200).json(detail);
  } catch (error) {
    console.error('[coach athlete detail api] failed:', error);
    res.status(500).json({ error: error.message || 'Could not load athlete detail.' });
  }
}
