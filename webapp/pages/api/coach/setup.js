import { getSupabaseAdminClient } from '../../../lib/authServer';
import {
  ensureCoachProfile,
  getAuthenticatedAthlete,
  getCoachProfileByAthleteId,
  normalizeCoachSpecialties,
  parseCommaSeparatedList,
} from '../../../lib/coachServer';

function cleanText(value, maxLength = null) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  return maxLength ? normalized.slice(0, maxLength) : normalized;
}

export default async function handler(req, res) {
  const athlete = await getAuthenticatedAthlete(req);
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const admin = getSupabaseAdminClient();

  if (req.method === 'GET') {
    const profile = await getCoachProfileByAthleteId(admin, athlete.id);
    res.status(200).json({ athlete, profile });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const displayName = cleanText(body.display_name, 120);
    const bio = cleanText(body.bio, 500);
    const specialties = normalizeCoachSpecialties(
      Array.isArray(body.specialties) ? body.specialties : []
    );
    const certifications = Array.isArray(body.certifications)
      ? body.certifications.map((item) => String(item || '').trim()).filter(Boolean)
      : parseCommaSeparatedList(body.certifications);
    const avatarUrl = cleanText(body.avatar_url, 500);

    if (!displayName) {
      res.status(400).json({ error: 'Display name is required.' });
      return;
    }

    const existing = await getCoachProfileByAthleteId(admin, athlete.id);

    if (!existing) {
      const created = await ensureCoachProfile(admin, athlete, {
        display_name: displayName,
        bio,
        specialties,
        certifications,
        avatar_url: avatarUrl,
        onboarding_completed: Boolean(body.onboarding_completed),
      });
      res.status(200).json({ profile: created });
      return;
    }

    const { data, error } = await admin
      .from('coach_profiles')
      .update({
        display_name: displayName,
        bio,
        specialties,
        certifications,
        avatar_url: avatarUrl,
        onboarding_completed: Boolean(body.onboarding_completed),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, athlete_id, display_name, coach_code, bio, specialties, certifications, avatar_url, onboarding_completed, created_at, updated_at')
      .single();

    if (error) {
      console.error('[coach/setup] update failed:', error);
      res.status(500).json({ error: 'Could not save coach profile.' });
      return;
    }

    res.status(200).json({ profile: data });
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
}
