import { getSupabaseAdminClient } from '../../../lib/authServer';
import { buildLoadMetrics } from '../../../lib/loadRollups';
import { latestJobPerAthlete, buildAthleteImportHealth, summarizeImportHealth } from '../../../lib/importHealth';
import { requireCoachAccess } from '../../../lib/auth/roleAccessServer.js';

// Coach tables are no longer reachable with the public anon key (RLS is on and
// the anon grants are revoked), so this route uses the service-role client.
// Authorisation is enforced in the handler from the session athlete id.
const supabase = getSupabaseAdminClient();

const emptySummary = {
  total_athletes: 0,
  active_protocols: 0,
  athletes_needing_attention: 0,
  upcoming_races: 0,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const access = await requireCoachAccess(req, res, supabase);
  if (!access) return;

  try {
    const profile = access.profile;

    const [{ data, error }, kpiRes] = await Promise.all([
      supabase.rpc('get_coach_dashboard_summary', { coach_uuid: profile.id }),
      supabase.rpc('get_coach_kpi_rollup', { coach_uuid: profile.id }),
    ]);

    if (error) { res.status(500).json({ error: error.message }); return; }

    const summary = (Array.isArray(data) ? data[0] : data) || emptySummary;

    const { data: activeLinks } = await supabase
      .from('coach_athlete_relationships')
      .select('athlete_id')
      .eq('coach_id', profile.id)
      .eq('status', 'active');

    const athleteIds = (activeLinks || []).map((item) => item.athlete_id);
    let loadSummary = { acute: 0, chronic: 0, form: 0 };
    let importJobs = [];
    if (athleteIds.length) {
      const [interventionsRes, activitiesRes, importJobsRes] = await Promise.all([
        supabase
          .from('interventions')
          .select('athlete_id, date, inserted_at, dose_duration, subjective_feel')
          .in('athlete_id', athleteIds)
          .gte('inserted_at', new Date(Date.now() - 42 * 86400000).toISOString()),
        supabase
          .from('strava_activities')
          .select('*')
          .in('athlete_id', athleteIds)
          .gte('start_date', new Date(Date.now() - 42 * 86400000).toISOString()),
        supabase
          .from('trainingpeaks_import_jobs')
          .select('id, athlete_id, status, transferred_count, needs_manual_mapping_count, error_message, created_at, followup_sent_at')
          .in('athlete_id', athleteIds)
          .order('created_at', { ascending: false }),
      ]);
      importJobs = importJobsRes.data || [];
      const metrics = athleteIds.map((athleteId) => buildLoadMetrics({
        interventions: (interventionsRes.data || []).filter((item) => item.athlete_id === athleteId),
        activities: (activitiesRes.data || []).filter((item) => item.athlete_id === athleteId),
        lookbackDays: 42,
      }));
      const divisor = Math.max(metrics.length, 1);
      loadSummary = {
        acute: Number((metrics.reduce((sum, item) => sum + item.acute, 0) / divisor).toFixed(1)),
        chronic: Number((metrics.reduce((sum, item) => sum + item.chronic, 0) / divisor).toFixed(1)),
        form: Number((metrics.reduce((sum, item) => sum + item.form, 0) / divisor).toFixed(1)),
      };
    }

    const jobsByAthlete = latestJobPerAthlete(importJobs);
    const importHealth = {
      summary: summarizeImportHealth(athleteIds, jobsByAthlete),
      athletes: Object.fromEntries(
        athleteIds.map((id) => [id, buildAthleteImportHealth(jobsByAthlete[id] || null)])
      ),
    };

    res.status(200).json({ summary, profile, loadSummary, coachKpis: kpiRes.data || null, importHealth });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
