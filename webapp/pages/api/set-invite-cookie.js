import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';

export const runtime = 'edge';

/**
 * POST /api/set-invite-cookie
 *
 * Called by /join before redirecting to Strava OAuth.
 * Validates the token exists and is unused, then sets an httpOnly
 * cookie so the callback handler can mark the invite as used
 * after the athlete is created.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token required' });

  const adminClient = getAdminClient();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server config error' });
  }

  const { data: invite, error } = await adminClient
    .from('invites')
    .select('id, used_at')
    .eq('token', token)
    .single();

  if (error || !invite) {
    return res.status(404).json({ error: 'Invalid invite token' });
  }

  if (invite.used_at) {
    return res.status(409).json({ error: 'This invite has already been used' });
  }

  // Set the pending invite token as an httpOnly short-lived cookie
  res.setHeader(
    'Set-Cookie',
    cookie.serialize('pending_invite_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 30, // 30 minutes — enough for OAuth flow
    })
  );

  return res.status(200).json({ valid: true });
}
