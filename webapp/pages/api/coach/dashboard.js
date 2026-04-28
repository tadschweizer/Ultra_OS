import { getCoachDashboardData } from '../../../lib/coachDashboard';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const dashboard = await getCoachDashboardData({ req });

    if (!dashboard.authenticated) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    res.status(200).json(dashboard);
  } catch (error) {
    console.error('[coach dashboard api] failed:', error);
    res.status(500).json({ error: error.message || 'Could not load coach dashboard.' });
  }
}
