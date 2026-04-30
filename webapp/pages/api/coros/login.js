import { getConnector } from '../../../lib/connectors';

export const runtime = 'edge';

export default function handler(req, res) {
  const provider = req.url.split('/').slice(-2)[0];
  const connector = getConnector(provider);

  if (!connector?.isConfigured()) {
    res.status(503).json({
      error: `${provider} connector not configured`,
      missing_env: [`${provider.toUpperCase()}_CLIENT_ID`, `${provider.toUpperCase()}_CLIENT_SECRET`, `${provider.toUpperCase()}_REDIRECT_URI`],
    });
    return;
  }

  const authUrl = connector.buildLoginUrl(`provider:${provider}`);
  res.setHeader('Location', authUrl);
  res.statusCode = 302;
  res.end();
}
