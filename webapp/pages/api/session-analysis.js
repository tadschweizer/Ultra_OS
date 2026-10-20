import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { getEffectiveAthleteIdFromRequest } from '../../lib/auth/requireAthlete.js';
import { loadAccountAccess, loadActiveCoachRelationship } from '../../lib/auth/roleAccessServer.js';
import { canReadWorkout } from '../../lib/workoutVisibility.js';
import { parseSubject } from '../../lib/workoutComments.js';
import { ensureStravaAccessToken } from '../../lib/activitySync.js';
import { getActivityStreams, getDetailedActivity } from '../../lib/strava.js';
import { integrationAvailability } from '../../lib/integrationAvailability.js';
import { sessionPoints } from '../../lib/sessionAnalysis.js';

export function createSessionAnalysisHandler({ getAdmin = getSupabaseAdminClient, resolveAthlete = getEffectiveAthleteIdFromRequest,
  accountAccess = loadAccountAccess, relationship = loadActiveCoachRelationship,
  tokenFor = ensureStravaAccessToken, streamsFor = getActivityStreams, detailsFor = getDetailedActivity,
  providerEnabled = () => integrationAvailability().strava } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
    try {
      const caller = await resolveAthlete(req);
      if (!caller) return res.status(401).json({ error: 'Sign in to view session analysis.' });
      const { workoutId, activityId, error } = parseSubject(req.query);
      if (error) return res.status(400).json({ error });
      const admin = getAdmin();
      async function read(table, id) {
        const result = await admin.from(table).select('*').eq('id', id).maybeSingle();
        if (result.error) throw result.error;
        return result.data;
      }
      const subject = await read(workoutId ? 'planned_workouts' : 'strava_activities', workoutId || activityId);
      if (!subject) return res.status(404).json({ error: 'Session not found.' });
      let coachId = null;
      if (subject.athlete_id !== caller) {
        const access = await accountAccess(admin, caller);
        coachId = access?.capabilities.coach ? access.coachProfile?.id : null;
        if (!coachId || !await relationship(admin, coachId, subject.athlete_id)) return res.status(403).json({ error: 'Session access denied.' });
      }
      if (workoutId && !canReadWorkout(subject, { athleteId: caller, coachId })) return res.status(403).json({ error: 'Session access denied.' });
      if (workoutId && subject.status !== 'completed') return res.status(400).json({ error: 'Analysis is available after completion.' });
      const activity = workoutId ? (subject.completed_activity_id ? await read('strava_activities', subject.completed_activity_id) : null) : subject;
      if (activity && activity.athlete_id !== subject.athlete_id) return res.status(403).json({ error: 'Session access denied.' });
      const summary = activity ? { moving_time: activity.moving_time, distance: activity.distance, sport: activity.sport_type, source: activity.source || 'strava' } : null;
      const response = { activity: summary, points: [], laps: [], settings: {}, recording: 'No linked recording. Manual results can be compared with the plan; charts require recorded samples.' };
      if (!activity) return res.json(response);
      response.recording = 'Detailed samples are unavailable for this provider or connection.';
      // Never return raw provider payloads, coordinates, credentials, or private descriptions.
      if ((activity.source || 'strava') !== 'strava' || !activity.strava_activity_id || !providerEnabled()) return res.json(response);
      const athlete = await read('athletes', subject.athlete_id);
      const token = await tokenFor(admin, athlete);
      if (!token) return res.json(response);
      const [streamResult, detailResult, settingsResult] = await Promise.allSettled([
        streamsFor(token, activity.strava_activity_id, ['time', 'distance', 'heartrate', 'velocity_smooth', 'altitude', 'cadence', 'watts']),
        detailsFor(token, activity.strava_activity_id),
        admin.from('athlete_settings').select('hr_zone_2_max, hr_zone_3_min, hr_zone_4_min').eq('athlete_id', subject.athlete_id).maybeSingle(),
      ]);
      if (streamResult.status === 'fulfilled') response.points = sessionPoints(streamResult.value);
      if (settingsResult.status === 'fulfilled' && !settingsResult.value.error) response.settings = settingsResult.value.data || {};
      const times = streamResult.status === 'fulfilled' ? streamResult.value?.time?.data : [];
      if (detailResult.status === 'fulfilled') response.laps = (detailResult.value?.laps || []).slice(0, 1000).map((lap, i) => ({
        label: `Lap ${i + 1}`, start: times?.[lap.start_index], end: times?.[lap.end_index],
      })).filter(lap => Number.isFinite(lap.start) && Number.isFinite(lap.end) && lap.end > lap.start);
      response.recording = response.points.length > 1 ? 'Recorded samples from Strava. Elapsed-time charts include stops. Gaps over 30 seconds are excluded from calculations.' : 'No detailed samples returned. The provider may be unavailable or this activity may contain summary data only. Retry to check again.';
      if (times?.length > 200000) response.recording += ' This very long recording is limited to its first 200,000 samples; later data is not analyzed.';
      return res.json(response);
    } catch {
      return res.status(503).json({ error: 'Session analysis could not load. Your saved workout is unchanged. Please retry.' });
    }
  };
}
export default createSessionAnalysisHandler();
