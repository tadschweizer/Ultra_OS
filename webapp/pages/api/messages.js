import {
  countUnreadMessagesForAthlete,
  createMessage,
  getCurrentMessagingActor,
  listConversationForAthlete,
  listThreadsForAthlete,
  markConversationRead,
} from '../../lib/messageServer';

export default async function handler(req, res) {
  try {
    const { admin, athlete } = await getCurrentMessagingActor(req);

    if (!athlete) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.method === 'GET') {
      const participantAthleteId = typeof req.query.participant === 'string' ? req.query.participant : null;
      const unreadCount = await countUnreadMessagesForAthlete(admin, athlete);

      if (participantAthleteId) {
        const conversation = await listConversationForAthlete(admin, athlete, participantAthleteId);
        res.status(200).json({ ...conversation, unreadCount });
        return;
      }

      const threads = await listThreadsForAthlete(admin, athlete);
      res.status(200).json({ ...threads, unreadCount });
      return;
    }

    if (req.method === 'POST') {
      const message = await createMessage(admin, athlete, req.body || {});
      const unreadCount = await countUnreadMessagesForAthlete(admin, athlete);
      res.status(200).json({ message, unreadCount });
      return;
    }

    if (req.method === 'PATCH') {
      const participantAthleteId = req.body?.participant_athlete_id;
      if (!participantAthleteId) {
        res.status(400).json({ error: 'participant_athlete_id is required' });
        return;
      }

      const updatedCount = await markConversationRead(admin, athlete, participantAthleteId);
      const unreadCount = await countUnreadMessagesForAthlete(admin, athlete);
      res.status(200).json({ updatedCount, unreadCount });
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error('[messages] failed:', error);
    res.status(500).json({ error: error.message || 'Could not load messages.' });
  }
}
