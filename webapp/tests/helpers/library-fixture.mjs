import { readFileSync } from 'node:fs';
import { fixture, owner, stranger, coach, response } from './message-lifecycle-fixture.mjs';
import { signAthleteSession } from '../../lib/auth/sessionCookies.js';
import { createWorkoutLibraryHandler } from '../../pages/api/workout-library.js';

export const legacyId = '88888888-8888-4888-8888-888888888888';
export const foreignCoach = '99999999-9999-4999-8999-999999999999';
export const metadataMigration = readFileSync(new URL('../../supabase/migrations/20261010025811_workout_library_plan_metadata.sql', import.meta.url), 'utf8');
export const createMigration = readFileSync(new URL('../../supabase/migrations/20261010042931_workout_library_create_idempotency.sql', import.meta.url), 'utf8');
export async function libraryFixture() {
  const f = await fixture();
  try {
  await f.pg.exec(`reset role; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    alter table athletes add column supabase_user_id uuid;
    update athletes set supabase_user_id=id;
    insert into coach_profiles(id,athlete_id,display_name) values('${foreignCoach}','${stranger}','Other coach');`);
  // Execute the real library foundation and the existing unit-column migration.
  const foundation = readFileSync(new URL('../../supabase/migrations/20260611120000_add_training_calendar.sql', import.meta.url), 'utf8');
  await f.pg.exec(foundation.split('CREATE TABLE IF NOT EXISTS public.planned_workouts')[0]);
  const units = readFileSync(new URL('../../supabase/migrations/20260721120000_workout_units_and_targets.sql', import.meta.url), 'utf8');
  await f.pg.exec(units.slice(units.indexOf('ALTER TABLE public.workout_library')));
  await f.pg.exec(`insert into workout_library(id,coach_id,name) values('${legacyId}','${coach}','Legacy easy run');`);
  const before = (await f.pg.query(`select policyname,qual,with_check from pg_policies where tablename='workout_library'`)).rows;
  await f.pg.exec(metadataMigration);
  await f.pg.exec(createMigration);
  await f.pg.exec(`grant select,insert,update,delete on workout_library to service_role; set role service_role;`);
  const handler = createWorkoutLibraryHandler({getClient:()=>f.admin});
  // Other browser fixtures configure their own local deployment origin. Use
  // the active test origin rather than relying on module-import ordering.
  const invoke = async ({actor=owner,version=1,method='GET',body={},query={},origin=process.env.NEXT_PUBLIC_SITE_URL || 'https://threshold.example',contentType='application/json'}={}) => {
    const res=response();
    await handler({method,body,query,headers:{origin,'content-type':contentType,cookie:actor?`athlete_id=${signAthleteSession(actor,version)}`:''}},res);
    return res;
  };
  return {...f,invokeLibrary:invoke,libraryPolicies:before};
  } catch(error) { await f.close(); throw error; }
}
