import test from 'node:test';
import assert from 'node:assert/strict';
import { coachReportFixture } from './helpers/coach-report-fixture.mjs';
import { usableReadinessScore, reportWindow } from '../lib/coachReport.js';

test('score inputs retain real zero and reject missing, blank, boolean, nonfinite and out-of-range values', () => {
  for (const value of [null, undefined, '', '  ', false, true, NaN, Infinity, -1, 101, 'not entered', {}, []]) assert.equal(usableReadinessScore(value), null);
  for (const value of [0, '0', 77, '77', 100]) assert.equal(usableReadinessScore(value), Number(value));
  assert.deepEqual(reportWindow(new Date('2026-10-11T00:01:00Z')), { start:'2026-09-14', end:'2026-10-11', days:28, timeZone:'UTC', sampleLimit:8 });
});

test('F1: unrelated logs never become per-assignment compliance; counts have explicit sample provenance', async () => {
  const f=await coachReportFixture();try {
    await f.seedProtocols();
    let r=await f.report();assert.equal(r.code,200);
    assert.deepEqual(r.body.compliance.map(p=>p.actual),[null,null]);
    const assignments=Object.fromEntries(r.body.compliance.map(p=>[p.protocol_name,p]));
    assert.equal(assignments.Heat.plannedSessions,2);assert.equal(assignments.Nutrition.plannedSessions,4);
    assert.equal(assignments.Heat.matchingSampleLogs,2);assert.equal(assignments.Nutrition.matchingSampleLogs,0);
    await f.pg.query("insert into interventions(athlete_id,intervention_type,date) values($1,'Sleep',current_date)",[f.athlete]);
    r=await f.report();assert.deepEqual(r.body.compliance.map(p=>p.actual),[null,null]);
    assert.match(r.body.raceReadiness.complianceSummary,/unavailable/i);
    assert.doesNotMatch(r.body.raceReadiness.complianceSummary,/%/);
    await f.pg.query(`insert into interventions(athlete_id,intervention_type,date) values
      ($1,'Heat Acclimation',current_date-7),($1,'Heat Acclimation',current_date-8)`,[f.athlete]);
    r=await f.report();assert.equal(r.body.compliance.find(p=>p.protocol_name==='Heat').matchingSampleLogs,3);
    const race='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await f.pg.query('insert into races(id,athlete_id,event_date) values($1,$2,current_date+14)',[race,f.athlete]);
    await f.pg.query('update coach_protocol_assignments set target_race_id=$1 where id=$2',[race,f.heat]);
    await f.pg.query(`insert into interventions(athlete_id,intervention_type,date,race_id) values
      ($1,'Heat Acclimation',current_date-2,$2),($1,'Heat Acclimation',current_date-3,null)`,[f.athlete,race]);
    r=await f.report();assert.equal(r.body.compliance.find(p=>p.protocol_name==='Heat').matchingSampleLogs,1);
    assert.deepEqual(f.queryErrors,[]);
  } finally {await f.close();}
});

test('F2: old, future and out-of-window logs cannot be called recent; report window and sample are explicit', async()=>{
  const f=await coachReportFixture();try {
    await f.seedProtocols();
    await f.pg.query(`insert into interventions(athlete_id,intervention_type,date,inserted_at) values
      ($1,'Sleep',current_date,now()),($1,'Sleep','2020-01-01','2020-01-01'),
      ($1,'Sleep',current_date+1,now()),($1,'Sleep',current_date-28,now())`,[f.athlete]);
    const r=await f.report();assert.equal(r.code,200);
    assert.equal(r.body.interventions.length,3);
    const sleep=r.body.raceReadiness.domains.find(d=>d.name==='Sleep');
    assert.match(sleep.note,/1 log/);assert.doesNotMatch(sleep.status,/On track|signal/);
    assert.equal(r.body.raceReadiness.window.days,28);assert.equal(r.body.raceReadiness.window.sampleLimit,8);
  } finally {await f.close();}
});

test('F3: NULL scores stay unknown; valid zero is observed and fast check-ins retain their existing formula', async()=>{
  const f=await coachReportFixture();try {
    await f.seedProtocols();
    await f.pg.query(`insert into daily_checkins(athlete_id,created_at,readiness_score) values
      ($1,now(),null),($1,now()-interval '1 day',null),($1,now()-interval '2 days',null)`,[f.athlete]);
    let r=await f.report();assert.equal(r.code,200);
    assert.equal(r.body.riskLevel,'unknown');assert.equal(r.body.raceReadiness.confidence,'unavailable');
    assert.ok(r.body.raceReadiness.missingData.includes('Recent usable readiness scores'));
    assert.doesNotMatch(r.body.raceReadiness.signals.join(' '),/average: 0|average: NaN/);
    await f.pg.query('update daily_checkins set readiness_score=0 where created_at=(select max(created_at) from daily_checkins)');
    r=await f.report();assert.equal(r.body.riskLevel,'red');assert.match(r.body.raceReadiness.signals.join(' '),/score: 0/);
    await f.pg.query('update daily_checkins set readiness_score=null');
    await f.pg.query(`insert into interventions(athlete_id,intervention_type,date,protocol_payload)
      values($1,'Workout Check-in',current_date,'{"legs_feel":8,"energy_feel":7,"perceived_effort":3}')`,[f.athlete]);
    r=await f.report();assert.equal(r.body.riskLevel,'green');assert.match(r.body.raceReadiness.signals.join(' '),/score: 77/);
    assert.ok(!r.body.raceReadiness.missingData.includes('Recent usable readiness scores'));
  } finally {await f.close();}
});

test('window filtering precedes sampling; stale/future workouts and scores are excluded and averages use only usable scores', async()=>{
  const f=await coachReportFixture();try {
    await f.pg.query(`insert into daily_checkins(athlete_id,created_at,readiness_score) values
      ($1,now(),null),($1,now()-interval '1 hour',20),($1,now()-interval '2 hours',40),($1,now()-interval '3 hours',60),
      ($1,'2020-01-01',100),($1,current_date+interval '1 day',100),($1,now()-interval '4 hours',101)`,[f.athlete]);
    await f.pg.query(`insert into strava_activities(athlete_id,strava_activity_id,start_date,name) values
      ($1,'recent',now(),'Recent trail run'),($1,'old','2020-01-01','Old run'),
      ($1,'future',current_date+interval '1 day','Future run'),
      ($1,'start-boundary',current_date-interval '27 days','Boundary run'),
      ($1,'outside-boundary',current_date-interval '28 days','Excluded run')`,[f.athlete]);
    await f.pg.query(`insert into interventions(athlete_id,intervention_type,date,inserted_at)
      select $1,'Sleep',current_date-27,now()-interval '2 years' from generate_series(1,10)`,[f.athlete]);
    const r=await f.report();assert.equal(r.code,200);
    assert.equal(r.body.interventions.length,8); // query filters by recorded date before applying the cap
    assert.deepEqual(r.body.activities.map(a=>a.strava_activity_id).sort(),['recent','start-boundary']);
    assert.equal(r.body.checkins.length,5);
    assert.match(r.body.raceReadiness.signals.join(' '),/score: 20|average: 40/);
    assert.ok(r.body.raceReadiness.signals.some(s=>s.includes('average: 40')));
    assert.equal(r.body.raceReadiness.confidence,'unavailable');
  } finally {await f.close();}
});

test('F4: real SQL failures return generic 503, never empty/not-found/compliance zero; unsigned access remains denied',async()=>{
  const f=await coachReportFixture();try {
    for(const table of ['coach_protocol_assignments','interventions','daily_checkins','races','strava_activities','coach_notes','planned_workouts','trainingpeaks_import_jobs']) {
      await f.pg.exec(`reset role; alter table ${table} rename to unavailable_${table}; set role service_role`);
      const r=await f.report();assert.equal(r.code,503,table);assert.match(r.body.error,/unavailable/i);
      assert.doesNotMatch(JSON.stringify(r.body),/42P01|relation|unavailable_|protocols|compliance/);
      await f.pg.exec(`reset role; alter table unavailable_${table} rename to ${table}; set role service_role`);
    }
    await f.pg.exec('reset role; alter table athletes rename column primary_sports to unavailable_primary_sports; set role service_role');
    assert.equal((await f.report()).code,503);
    await f.pg.exec('reset role; alter table athletes rename column unavailable_primary_sports to primary_sports; set role service_role');
    assert.equal((await f.invoke('detail',{actor:null,query:{athlete_id:f.athlete}})).code,401);
    assert.ok(f.queryErrors.some(e=>e.code==='42P01'));assert.ok(f.queryErrors.some(e=>e.code==='42703'));
  } finally {await f.close();}
});
