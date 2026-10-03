// A scoped personal training archive, not a dump of a coach's other athletes.
export const EXPORT_TABLES = [
  'interventions', 'athlete_settings', 'athlete_supplements', 'races', 'planned_workouts',
  'calendar_notes', 'strava_activities', 'coros_activities', 'coach_athlete_relationships',
  'coach_protocol_assignments', 'assigned_protocols', 'coach_messages', 'trainingpeaks_import_jobs',
];
const sensitive = /token|secret|password|api[_-]?key|session[_-]?version|supabase_user_id|stripe_/i;
export function redactExport(value) {
  if (Array.isArray(value)) return value.map(redactExport);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, redactExport(item)]));
  return value;
}
export async function collectAccountExport(admin, athlete, { pageSize = 1000, maxRows = 100000 } = {}) {
  const sections = {}; const unavailable = [];
  // Include the athlete's profile fields while excluding login/provider credentials.
  sections.profile = redactExport(athlete);
  for (const table of EXPORT_TABLES) {
    const records = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await admin.from(table).select('*').eq('athlete_id', athlete.id)
        .order(table === 'athlete_settings' ? 'athlete_id' : 'id', { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) {
        // Older deployments may not have a feature table. Make omissions explicit.
        if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code)) { unavailable.push(table); break; }
        throw error;
      }
      records.push(...(data || []));
      if (records.length > maxRows) throw new Error('Export exceeds download limit.');
      if (!data || data.length < pageSize) break;
    }
    if (!unavailable.includes(table)) sections[table] = redactExport(records);
  }
  return { format: 'threshold-personal-training-v1', generatedAt: new Date().toISOString(),
    scope: 'Your profile and personal training records. Coach-only notes, other athletes, uploaded file contents, and provider credentials are excluded. Contact support for additional records.',
    unavailableSections: unavailable, sections };
}
