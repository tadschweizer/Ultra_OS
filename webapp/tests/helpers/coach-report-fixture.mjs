import { calendarFixture, migration, athlete, owner, coach } from './calendar-gap-fixture.mjs';

// The legacy assignment migration supplies actual date/session constraints.
// Route-read columns missing from checked-in DDL are explicit test scaffolding;
// this fixture does not establish production schema or NULL-score feasibility.
export async function coachReportFixture() {
  const f = await calendarFixture();
  // PGlite inherits the Windows host zone; align SQL current_date fixtures with
  // the route's explicitly advertised UTC calendar-day window.
  await f.pg.exec("set time zone 'UTC'");
  await f.pg.exec('reset role; drop table coach_protocol_assignments; alter table races add primary key(id);');
  await f.pg.exec(migration('20260325103000_add_coach_protocols_and_race_type.sql'));
  await f.pg.exec(`alter table coach_protocol_assignments add column protocol_name text, add column description text, add column protocol_payload jsonb;
    alter table daily_checkins add column readiness_score integer;
    alter table interventions add column race_id uuid;
    delete from planned_workouts; delete from interventions; delete from strava_activities;
    update athletes set name='Synthetic report runner',email='report@example.test',primary_sports=array['run'] where id='${athlete}';
    grant select,insert,update,delete on all tables in schema public to service_role; set role service_role;`);
  const queryErrors = [];
  const from = f.admin.from.bind(f.admin);
  f.admin.from = table => {
    const q = from(table), then = q.then.bind(q);
    q.then = resolve => then(result => {
      if (result.error) queryErrors.push({ table, code: result.error.code });
      // Match PostgREST DATE wire values. The shared calendar adapter already
      // normalizes workout_date/date/local_date, but not these report columns.
      for (const row of Array.isArray(result.data) ? result.data : result.data ? [result.data] : []) {
        for (const key of ['start_date','target_completion_date','event_date']) {
          if ((table === 'coach_protocol_assignments' || table === 'races') && row[key]) row[key] = String(row[key]).slice(0,10);
        }
      }
      return resolve(result);
    });
    return q;
  };
  const heat = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nutrition = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  async function seedProtocols() {
    await f.pg.query(`insert into coach_protocol_assignments
      (id,athlete_id,coach_id,intervention_type,protocol_name,start_date,target_completion_date,frequency_type,planned_sessions,status)
      values($1,$3,$4,'Heat Acclimation','Heat',current_date-7,current_date,'weekly',2,'active'),
      ($2,$3,$4,'Nutrition','Nutrition',current_date-7,current_date,'weekly',4,'active')`,[heat,nutrition,athlete,coach]);
    await f.pg.query(`insert into interventions(athlete_id,intervention_type,date) values
      ($1,'Heat Acclimation',current_date-1),($1,'Heat Acclimation',current_date)`,[athlete]);
  }
  async function invokeWithCookie(name, cookie, query = {}) {
    const headers = {};
    const req = { method:'GET', query, headers:{ origin:'http://localhost:3000', cookie } };
    const res = { code:200, headers, getHeader:key=>headers[key], setHeader:(key,value)=>{headers[key]=value;},
      status(code){this.code=code;return this;},json(body){this.body=body;return this;} };
    await f.handlers[name](req,res);
    return res;
  }
  // Bound the real handler's report clock without changing production time or
  // adding a public clock override. Calls in these isolated tests are serial.
  async function atReportTime(instant, invoke) {
    const RealDate = globalThis.Date;
    const time = RealDate.parse(instant);
    if (!Number.isFinite(time)) throw new Error('Invalid fixture report time');
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [time])); }
      static now() { return time; }
    };
    try { return await invoke(); } finally { globalThis.Date = RealDate; }
  }
  return { ...f, athlete, owner, coach, heat, nutrition, queryErrors, seedProtocols,
    invokeWithCookie, atReportTime,
    report: () => f.invoke('detail', { actor: owner, query: { athlete_id: athlete } }) };
}
