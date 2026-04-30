import { getConnector } from '../../../lib/connectors';

export const runtime = 'edge';

export default async function handler(req, res) {
  const provider = req.url.split('/').slice(-2)[0];
  const connector = getConnector(provider);
  const { code } = req.query;

  if (!connector?.isConfigured()) {
    res.status(503).json({ error: `${provider} connector not configured` });
    return;
  }

  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const tokenData = await connector.exchangeToken(code);
    res.status(200).json({
      provider,
      status: 'placeholder_callback_success',
      note: 'Persist this token payload to Supabase once provider credentials are approved.',
      token_data: tokenData,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed ${provider} callback`, detail: error.message });
  }
}
