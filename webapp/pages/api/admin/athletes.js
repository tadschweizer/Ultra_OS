import { createClient } from '@supabase/supabase-js';
import { requireAdminAthleteId } from '../../../lib/auth/requireAthlete.js';

/**
 * GET /api/admin/athletes
 *
 * Returns all athletes with their intervention counts plus roster data-health
 * stats. Exactly two Supabase queries regardless of athlete count (the old
 * version ran one interventions query per athlete).
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role config');
  return createClient(url, serviceKey);
}

const WEEK_MS = 7 * 86400000;

export function buildDataHealth(athletes, interventions, now = Date.now()) {
  const perAthlete = new Map();
  const typeCounts = new Map();
  const checkinsPerWeek = [0, 0, 0, 0]; // index 0 = current week (last 7 days)

  for (const row of interventions) {
    const stats = perAthlete.get(row.athlete_id) || { count: 0, lastAt: null };
    stats.count += 1;
    if (!stats.lastAt || row.inserted_at > stats.lastAt) stats.lastAt = row.inserted_at;
    perAthlete.set(row.athlete_id, stats);

    if (row.intervention_type) {
      typeCounts.set(row.intervention_type, (typeCounts.get(row.intervention_type) || 0) + 1);
    }
    if (row.intervention_type === 'Workout Check-in' && row.inserted_at) {
      const weeksAgo = Math.floor((now - new Date(row.inserted_at).getTime()) / WEEK_MS);
      if (weeksAgo >= 0 && weeksAgo < 4) checkinsPerWeek[weeksAgo] += 1;
    }
  }

  let activeLast7d = 0;
  let dormant14d = 0;
  for (const athlete of athletes) {
    const lastAt = perAthlete.get(athlete.id)?.lastAt || null;
    if (lastAt && now - new Date(lastAt).getTime() <= 7 * 86400000) activeLast7d += 1;
    if (!lastAt || now - new Date(lastAt).getTime() >= 14 * 86400000) dormant14d += 1;
  }

  const topInterventionTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  return { perAthlete, activeLast7d, dormant14d, checkinsPerWeek, topInterventionTypes };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getAdminClient();
  const athleteId = await requireAdminAthleteId(req, res, supabase);
  if (!athleteId) return;

  // NOTE: interventions has `inserted_at` and `date` — there is NO logged_at
  // column (recent-logs aliases inserted_at for the client).
  const [athletesRes, interventionsRes] = await Promise.all([
    supabase
      .from('athletes')
      .select('id, name, email, strava_id, created_at, is_admin, onboarding_complete')
      .order('created_at', { ascending: false }),
    supabase
      .from('interventions')
      .select('athlete_id, inserted_at, intervention_type'),
  ]);

  if (athletesRes.error) return res.status(500).json({ error: athletesRes.error.message });
  if (interventionsRes.error) return res.status(500).json({ error: interventionsRes.error.message });

  const athletes = athletesRes.data || [];
  const health = buildDataHealth(athletes, interventionsRes.data || []);

  const enriched = athletes.map((a) => {
    const stats = health.perAthlete.get(a.id) || { count: 0, lastAt: null };
    return { ...a, intervention_count: stats.count, last_intervention_at: stats.lastAt };
  });

  return res.status(200).json({
    athletes: enriched,
    dataHealth: {
      activeLast7d: health.activeLast7d,
      dormant14d: health.dormant14d,
      checkinsPerWeek: health.checkinsPerWeek,
      topInterventionTypes: health.topInterventionTypes,
    },
  });
}
