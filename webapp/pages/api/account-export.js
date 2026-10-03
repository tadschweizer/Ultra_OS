import { getAthleteByCookie, getSupabaseAdminClient } from '../../lib/authServer.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { collectAccountExport } from '../../lib/accountExport.js';
export function createAccountExportHandler({ getClient = getSupabaseAdminClient, getAthlete = getAthleteByCookie } = {}) {
  return async function handler(req, res) {
    try {
      if (!requireSameOriginJson(req, res)) return;
      const admin = getClient(); const athlete = await getAthlete(req, admin);
      if (!athlete) return res.status(401).json({ error: 'Please log in to download your records.' });
      const archive = await collectAccountExport(admin, athlete);
      res.setHeader('Content-Disposition', 'attachment; filename="threshold-personal-training.json"');
      return res.status(200).json(archive);
    } catch (error) {
      console.error('[account-export] failed:', { code: error?.code });
      return res.status(503).json({ error: 'Your download could not be prepared. Please retry or contact support.' });
    }
  };
}
export default createAccountExportHandler();
