import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getAthleteIdFromRequest, requireAdminRequest } from '../../lib/authServer';


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

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);

  // ── GET: list invites ─────────────────────────────────────────
  if (req.method === 'GET') {
    const adminContext = await requireAdminRequest(req, res);
    if (!adminContext) return;
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
    const adminContext = await requireAdminRequest(req, res);
    if (!adminContext) return;
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
