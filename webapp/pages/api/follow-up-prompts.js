import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../lib/authServer';
import {
  listActivityFollowUpPrompts,
  updateActivityFollowUpPromptStatus,
} from '../../lib/providerEvents';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    if (req.method === 'GET') {
      const prompts = await listActivityFollowUpPrompts(admin, {
        athleteId,
        status: 'pending',
        limit: 20,
      });

      res.status(200).json({ prompts });
      return;
    }

    const { id, status } = req.body || {};
    if (!id || !status) {
      res.status(400).json({ error: 'Prompt id and status are required.' });
      return;
    }

    const prompt = await updateActivityFollowUpPromptStatus(admin, {
      athleteId,
      promptId: id,
      status,
    });

    res.status(200).json({ prompt });
  } catch (error) {
    console.error('[follow-up-prompts] failed:', error);
    res.status(500).json({ error: error.message || 'Failed to load follow-up prompts.' });
  }
}
