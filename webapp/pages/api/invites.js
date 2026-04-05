import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';
import crypto from 'crypto';

export const runtime = 'edge';

/**
 * /api/invites
 *
 * GET  — list all invites (admin only)
 * POST — create a new invite token (admin only)
 * PUT  — validate a token and mark it used (public, called from /join)
 */

// Use service role key for admin operations that bypass RLS
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role config');
  return createClient(url, serviceKey);
}

async function getAthleteId(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.athlete_id || null;
}

async function isAdmin(athleteId) {
  if (!athleteId) return false;
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('athletes')
    .select('is_admin')
    .eq('id', athleteId)
    .single();
  return Boolean(data?.is_admin);
}

export default async function handler(req, res) {
  const athleteId = await getAthleteId(req);

  // ── GET: list invites ─────────────────────────────────────────
  if (req.method === 'GET') {
    if (!(await isAdmin(athleteId))) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('invites')
      .select('id, token, email, notes, created_at, used_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ invites: data });
  }

  // ── POST: create invite ───────────────────────────────────────
  if (req.method === 'POST') {
    if (!(await isAdmin(athleteId))) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { email = null, notes = null } = req.body || {};
    const token = crypto.randomBytes(24).toString('hex');
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('invites')
      .insert({ token, email, notes, created_by: athleteId })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/join?token=${token}`;
    return res.status(201).json({ invite: data, joinUrl });
  }

  // ── PUT: validate token (called from /join before Strava OAuth) ─
  if (req.method === 'PUT') {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token required' });

    const supabase = getAdminClient();
    const { data: invite, error } = await supabase
      .from('invites')
      .select('id, token, used_at, email')
      .eq('token', token)
      .single();

    if (error || !invite) return res.status(404).json({ error: 'Invalid invite token' });
    if (invite.used_at) return res.status(409).json({ error: 'This invite has already been used' });

    return res.status(200).json({ valid: true, email: invite.email });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
