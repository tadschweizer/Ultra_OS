import { buildResearchDraft } from '../../../lib/researchDrafts';
import { requireAdminRequest } from '../../../lib/authServer';


export default async function handler(req, res) {
  const adminContext = await requireAdminRequest(req, res);
  if (!adminContext) return;

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
