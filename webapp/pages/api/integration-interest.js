import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';

// Server-side routes cannot use the anon client: it carries no Supabase
// session, so auth.uid() is null and every RLS policy denies it. This route
// uses the service-role client and authorises from the session athlete id.
const supabase = getSupabaseAdminClient();

const ALLOWED_SOURCES = new Set([
  'Garmin',
  'COROS',
  'Zwift',
  'TrainingPeaks',
  'Oura',
  'Ultrahuman',
  'CORE Body Temp',
]);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const source = typeof req.body?.source === 'string' ? req.body.source.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!ALLOWED_SOURCES.has(source)) {
    res.status(400).json({ error: 'Unsupported source' });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please provide a valid email.' });
    return;
  }

  const athleteId = getAthleteIdFromRequest(req) || null;

  const { error } = await supabase
    .from('integration_interest')
    .upsert(
      {
        athlete_id: athleteId,
        email,
        source_name: source,
      },
      { onConflict: 'email,source_name' },
    );

  if (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record integration interest.' });
    return;
  }

  res.status(200).json({
    ok: true,
    source,
    message: `Thanks — we'll notify you when ${source} is available.`,
  });
}
