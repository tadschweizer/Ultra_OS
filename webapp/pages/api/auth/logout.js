import cookie from 'cookie';

/**
 * POST /api/auth/logout
 *
 * Clears the athlete_id session cookie.
 * The client should also call supabase.auth.signOut() to clear
 * the client-side Supabase session.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expiredCookie = cookie.serialize('athlete_id', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.setHeader('Set-Cookie', expiredCookie);
  res.status(200).json({ ok: true });
}
