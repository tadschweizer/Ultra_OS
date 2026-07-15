import { createClient } from '@supabase/supabase-js';
import { requireAdminAthleteId } from '../../../lib/auth/requireAthlete.js';
import { generateCoachCode } from '../../../lib/coachProtocols';
import {
  DEMO_ATHLETE_EMAIL,
  DEMO_ATHLETE_NAME,
  DEMO_COACH_EMAIL,
  DEMO_COACH_NAME,
  buildDemoSeed,
  generateDemoPassword,
} from '../../../lib/adminDemo.js';

/**
 * Admin demo sandbox — a linked coach/athlete account pair with seeded
 * training data, so an admin can log into both (e.g. one normal window,
 * one incognito) and exercise every coach↔athlete feature with real writes.
 *
 * GET    /api/admin/demo — current demo accounts (no passwords; those are
 *        only returned at creation time — use reset to get fresh ones).
 * POST   /api/admin/demo { reset?: true } — create the pair; with reset,
 *        wipe and recreate (fresh data + fresh passwords).
 * DELETE /api/admin/demo — remove the pair and all their data.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role config');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

const DEMO_EMAILS = [DEMO_COACH_EMAIL, DEMO_ATHLETE_EMAIL];

async function listDemoAthletes(supabase) {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, name, email, subscription_tier, supabase_user_id, created_at')
    .eq('is_demo', true);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Deletes the demo athletes' rows (cascades cover interventions, races,
 * planned workouts, coach profile + links + assignments) and their auth
 * users — including lingering auth users from a previous partial delete.
 */
async function deleteDemoPair(supabase) {
  const demoAthletes = await listDemoAthletes(supabase);

  for (const athlete of demoAthletes) {
    if (athlete.supabase_user_id) {
      const { error } = await supabase.auth.admin.deleteUser(athlete.supabase_user_id);
      if (error && !/not.*found/i.test(error.message)) {
        console.warn(`[admin/demo] auth delete failed for ${athlete.email}:`, error.message);
      }
    }
  }

  if (demoAthletes.length > 0) {
    const { error } = await supabase
      .from('athletes')
      .delete()
      .eq('is_demo', true);
    if (error) throw new Error(error.message);
  }

  // Auth users can outlive their athletes row if a previous create failed
  // halfway — sweep by email so recreation never hits "email exists".
  const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!listError) {
    for (const user of usersPage?.users || []) {
      if (DEMO_EMAILS.includes(user.email)) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    }
  }

  return demoAthletes.length;
}

async function insertOrThrow(supabase, table, rows) {
  const { data, error } = await supabase.from(table).insert(rows).select('id');
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function createDemoAccount(supabase, { email, name, password, tier }) {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData?.user) {
    throw new Error(`auth user for ${email}: ${authError?.message || 'unknown error'}`);
  }

  const { data: athlete, error } = await supabase
    .from('athletes')
    .insert({
      name,
      email,
      supabase_user_id: authData.user.id,
      subscription_tier: tier,
      subscription_activated_at: new Date().toISOString(),
      onboarding_complete: true,
      is_demo: true,
      primary_sports: ['ultrarunner', 'trail_runner'],
      years_racing_band: '4-6',
      weekly_training_hours_band: '8-12',
      home_elevation_ft: 5200,
    })
    .select('id, name, email, subscription_tier')
    .single();
  if (error) throw new Error(`athletes row for ${email}: ${error.message}`);
  return athlete;
}

async function createDemoPair(supabase) {
  const coachPassword = generateDemoPassword();
  const athletePassword = generateDemoPassword();

  const coach = await createDemoAccount(supabase, {
    email: DEMO_COACH_EMAIL, name: DEMO_COACH_NAME, password: coachPassword, tier: 'coach',
  });
  const athlete = await createDemoAccount(supabase, {
    email: DEMO_ATHLETE_EMAIL, name: DEMO_ATHLETE_NAME, password: athletePassword, tier: 'individual',
  });

  const [coachProfile] = await insertOrThrow(supabase, 'coach_profiles', {
    athlete_id: coach.id,
    display_name: DEMO_COACH_NAME,
    coach_code: generateCoachCode(DEMO_COACH_NAME),
  });

  // Legacy link (coach-roster.js) AND the Command Center relationship —
  // /api/coach/dashboard, /api/coach/relationships, /api/planned-workouts,
  // and /api/message-center all resolve access via coach_athlete_relationships.
  await insertOrThrow(supabase, 'coach_athlete_links', {
    athlete_id: athlete.id,
    coach_id: coachProfile.id,
    role: 'primary',
    status: 'active',
  });
  await insertOrThrow(supabase, 'coach_athlete_relationships', {
    athlete_id: athlete.id,
    coach_id: coachProfile.id,
    status: 'active',
    accepted_at: new Date().toISOString(),
    group_name: 'Demo Squad',
  });

  const seed = buildDemoSeed();

  const [race] = await insertOrThrow(supabase, 'races', {
    ...seed.race,
    athlete_id: athlete.id,
  });
  await supabase.from('athletes').update({ target_race_id: race.id }).eq('id', athlete.id);

  await insertOrThrow(
    supabase,
    'interventions',
    seed.interventions.map((row) => ({ ...row, athlete_id: athlete.id, race_id: race.id })),
  );

  await insertOrThrow(
    supabase,
    'planned_workouts',
    seed.plannedWorkouts.map(({ coachAssigned, ...row }) => ({
      ...row,
      athlete_id: athlete.id,
      coach_id: coachAssigned ? coachProfile.id : null,
    })),
  );

  await insertOrThrow(supabase, 'coach_protocol_assignments', {
    ...seed.protocolAssignment,
    athlete_id: athlete.id,
    coach_id: coachProfile.id,
    target_race_id: race.id,
  });

  const { error: settingsError } = await supabase
    .from('athlete_settings')
    .upsert({ ...seed.settings, athlete_id: athlete.id });
  if (settingsError) throw new Error(`athlete_settings: ${settingsError.message}`);

  return {
    coach: { ...coach, password: coachPassword },
    athlete: { ...athlete, password: athletePassword },
  };
}

export default async function handler(req, res) {
  const supabase = getAdminClient();
  const adminId = await requireAdminAthleteId(req, res, supabase);
  if (!adminId) return;

  try {
    if (req.method === 'GET') {
      const demoAthletes = await listDemoAthletes(supabase);
      return res.status(200).json({ exists: demoAthletes.length > 0, accounts: demoAthletes });
    }

    if (req.method === 'DELETE') {
      const removed = await deleteDemoPair(supabase);
      console.log(`[admin/demo] ${adminId} deleted demo pair (${removed} accounts)`);
      return res.status(200).json({ ok: true, removed });
    }

    if (req.method === 'POST') {
      const existing = await listDemoAthletes(supabase);
      if (existing.length > 0 && !req.body?.reset) {
        return res.status(409).json({
          error: 'Demo accounts already exist. Pass { reset: true } to wipe and recreate them.',
        });
      }
      // Always run the delete/sweep, even when no athletes rows exist: a
      // previous create that failed between createUser and the athletes
      // insert leaves orphan auth users that would block re-creation with
      // "email already exists".
      await deleteDemoPair(supabase);
      const credentials = await createDemoPair(supabase);
      console.log(`[admin/demo] ${adminId} created demo pair`);
      return res.status(200).json({ ok: true, credentials });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[admin/demo]', error);
    return res.status(500).json({ error: error.message || 'Demo setup failed' });
  }
}
