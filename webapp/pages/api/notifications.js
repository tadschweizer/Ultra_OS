import { syncNotificationsForCurrentUser, updateNotificationState } from '../../lib/notificationServer';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await syncNotificationsForCurrentUser(req);
      if (!result.athlete) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      res.status(200).json(result);
      return;
    }

    if (req.method === 'PATCH') {
      const id = req.body?.id;
      const action = req.body?.action;
      if (!id || !action) {
        res.status(400).json({ error: 'id and action are required' });
        return;
      }

      const result = await updateNotificationState({ req, id, action });
      if (!result.athlete) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const refreshed = await syncNotificationsForCurrentUser(req);
      res.status(200).json(refreshed);
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error('[notifications] failed:', error);
    res.status(500).json({ error: error.message || 'Could not load notifications.' });
  }
}
