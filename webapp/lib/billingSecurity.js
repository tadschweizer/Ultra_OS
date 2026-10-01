import crypto from 'crypto';

// Use the configured deployment origin; never trust forwarded host headers.
export function billingSiteUrl() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_SITE_URL || url.protocol !== 'https:')) {
    throw new Error('Billing requires a configured HTTPS site URL.');
  }
  return url.origin;
}

export function requireBillingPost(req, res) {
  return requireSameOriginJson(req, res, 'POST', 'Please open billing from your Threshold account.');
}

export function requireSameOriginJson(req, res, method = 'POST', message = 'Please open this action from your Threshold account.') {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).json({ error: 'Method not allowed.' });
    return false;
  }
  const origin = req.headers.origin;
  const localOrigins = process.env.NODE_ENV !== 'production'
    ? ['http://127.0.0.1:3000', 'http://localhost:3000'] : [];
  if (typeof origin !== 'string' || ![billingSiteUrl(), ...localOrigins].includes(origin)
      || req.headers['sec-fetch-site'] === 'cross-site') {
    res.status(403).json({ error: message });
    return false;
  }
  if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    res.status(415).json({ error: 'A JSON request is required.' });
    return false;
  }
  return true;
}

function signingSecret() {
  const secret = process.env.SESSION_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Billing signing secret unavailable.');
  return secret;
}

export function signBillingIntent(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${crypto.createHmac('sha256', signingSecret()).update(encoded).digest('base64url')}`;
}

export function verifyBillingIntent(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = crypto.createHmac('sha256', signingSecret()).update(encoded).digest('base64url');
  if (signature.length !== expected.length
      || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return Number.isFinite(payload.expiresAt) && payload.expiresAt > now ? payload : null;
  } catch { return null; }
}
