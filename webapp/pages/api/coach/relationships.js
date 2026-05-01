import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';
import { buildLoadMetrics, buildLoadStatus } from '../../../lib/loadRollups';

export const runtime = 'edge';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase.from('athletes').select('id, name').eq('id', athleteId).single();
  const { data: existing } = await supabase.from('coach_profiles').select('id, athlete_id, display_name, coach_code').eq('athlete_id', athleteId).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({
      athlete_id: athleteId,
      display_name: athlete?.name || 'Coach',
      coach_code: generateCoachCode(athlete?.name || 'Coach'),
    })
    .select('id, athlete_id, display_name, coach_code')
    .single();

  if (error) throw error;
  return data;
}

function daysSince(dateString) {
  if (!dateString) return null;
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    if (req.method === 'GET') {
      const { data: relationships, error } = await supabase
        .from('coach_athlete_relationships')
        .select('id, athlete_id, status, invited_at, accepted_at, removed_at, group_name, notes, created_at')
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: true });

      if (error) { res.status(500).json({ error: error.message }); return; }

      const athleteIds = (relationships || []).map((r) => r.athlete_id);
      if (!athleteIds.length) {
        res.status(200).json({ relationships: [], profile, atRiskAthletes: 0, avgCommunicationSlaHours: null });
        return;
      }

      const [athleteRes, interventionsRes, raceRes, protocolRes, noteRes, checkinRes, loadInterventionRes, loadActivityRes] = await Promise.all([
        supabase.from('athletes').select('id, name, email, primary_sports, target_race_id').in('id', athleteIds),
        supabase.from('interventions').select('athlete_id, date, inserted_at').in('athlete_id', athleteIds).order('inserted_at', { ascending: false }),
        supabase.from('races').select('id, athlete_id, name, event_date').in('athlete_id', athleteIds).gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }),
        supabase.from('coach_protocol_assignments').select('athlete_id, protocol_name, compliance_target, status, start_date, end_date').in('athlete_id', athleteIds),
        supabase.from('coach_notes').select('athlete_id, created_at').eq('coach_id', profile.id).in('athlete_id', athleteIds).order('created_at', { ascending: false }),
        supabase.from('daily_checkins').select('athlete_id, created_at, readiness_score').in('athlete_id', athleteIds).order('created_at', { ascending: false }),
        supabase.from('interventions').select('athlete_id, date, inserted_at, dose_duration, subjective_feel').in('athlete_id', athleteIds).gte('inserted_at', new Date(Date.now() - 42 * 86400000).toISOString()),
        supabase.from('activities').select('athlete_id, start_date, moving_time, perceived_exertion').in('athlete_id', athleteIds).gte('start_date', new Date(Date.now() - 42 * 86400000).toISOString()),
      ]);

      const athletes = athleteRes.data || [];
      const interventions = interventionsRes.data || [];
      const races = raceRes.data || [];
      const protocols = protocolRes.data || [];
      const notes = noteRes.data || [];
      const checkins = checkinRes.data || [];
      const loadInterventions = loadInterventionRes.data || [];
      const loadActivities = loadActivityRes.data || [];

      const enriched = (relationships || []).map((rel) => {
        const athlete = athletes.find((a) => a.id === rel.athlete_id) || null;
        const athleteInterventions = interventions.filter((i) => i.athlete_id === rel.athlete_id);
        const athleteRaces = races.filter((r) => r.athlete_id === rel.athlete_id);
        const athleteProtocols = protocols.filter((p) => p.athlete_id === rel.athlete_id && ['assigned', 'in_progress', 'active'].includes(p.status));
        const athleteNotes = notes.filter((n) => n.athlete_id === rel.athlete_id);
        const athleteCheckins = checkins.filter((c) => c.athlete_id === rel.athlete_id);

        const lastLog = athleteInterventions[0] || null;
        const lastCheckin = athleteCheckins[0] || null;
        const nextRace = athleteRaces[0] || null;
        const daysSinceLog = daysSince(lastLog?.date || lastLog?.inserted_at);
        const daysSinceCoachNote = daysSince(athleteNotes[0]?.created_at);
        const missedProtocolLogs = athleteProtocols.filter((p) => {
          const elapsedDays = Math.max(1, daysSince(p.start_date) ?? 1);
          const expected = Math.max(1, Math.round(elapsedDays / 2));
          return athleteInterventions.length < expected;
        }).length;

        const protocolComplianceGap = athleteProtocols.length
          ? Math.max(...athleteProtocols.map((p) => Math.max(0, (p.compliance_target || 80) - Math.min(100, Math.round((athleteInterventions.length / Math.max(1, 7)) * 100)))))
          : 0;

        let readiness = 'green';
        const latestReadiness = lastCheckin?.readiness_score;
        if (latestReadiness !== undefined && latestReadiness !== null) {
          readiness = latestReadiness < 45 ? 'red' : latestReadiness < 70 ? 'yellow' : 'green';
        } else if (daysSinceLog === null || daysSinceLog > 6) readiness = 'red';
        else if (daysSinceLog > 3 || protocolComplianceGap > 20) readiness = 'yellow';

        const flagReasons = [];
        if (daysSinceLog === null || daysSinceLog >= 5) flagReasons.push('Missed recent logging rhythm');
        if (missedProtocolLogs > 0) flagReasons.push('Protocol logs appear behind schedule');
        if (protocolComplianceGap > 15) flagReasons.push(`Compliance is ${protocolComplianceGap}% below target`);
        if (nextRace?.event_date) flagReasons.push(`Upcoming race on ${nextRace.event_date}`);

        const flagSuggestion = readiness === 'red'
          ? 'Reach out today, review barriers, and simplify this week protocol expectations.'
          : readiness === 'yellow'
            ? 'Send quick check-in and confirm next 48h protocol plan.'
            : 'Keep current plan and reinforce consistency.';

        const loadMetrics = buildLoadMetrics({
          interventions: loadInterventions.filter((item) => item.athlete_id === rel.athlete_id),
          activities: loadActivities.filter((item) => item.athlete_id === rel.athlete_id),
          lookbackDays: 42,
        });

        return {
          ...rel,
          athlete,
          nextRace,
          lastLogDate: lastLog?.date || lastLog?.inserted_at || null,
          daysSinceLog,
          missedProtocolLogs,
          protocolComplianceGap,
          lastCheckinAt: lastCheckin?.created_at || null,
          readiness,
          alertLevel: readiness,
          flagReasons,
          flagSuggestion,
          communicationSlaHours: daysSinceCoachNote === null ? null : daysSinceCoachNote * 24,
          loadMetrics,
          loadStatus: buildLoadStatus(loadMetrics),
        };
      });

      const atRiskAthletes = enriched.filter((r) => r.alertLevel !== 'green').length;
      const communicationSlaHours = enriched.map((r) => r.communicationSlaHours).filter((v) => v !== null && v !== undefined);
      const avgCommunicationSlaHours = communicationSlaHours.length ? Math.round(communicationSlaHours.reduce((a, b) => a + b, 0) / communicationSlaHours.length) : null;

      res.status(200).json({ relationships: enriched, profile, atRiskAthletes, avgCommunicationSlaHours });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
