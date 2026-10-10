import './isolation-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createPlannedWorkoutsHandler } from './source/webapp/pages/api/planned-workouts.js';
import meHandler from './source/webapp/pages/api/me.js';
import { buildLoadMetrics, buildLoadStatus } from './source/webapp/lib/loadRollups.js';
import { computeActivityTrimp } from './source/webapp/lib/trainingLoad.js';
import { summarizeWeek } from './source/webapp/lib/workoutCompliance.js';
import { calendarMutation } from './source/webapp/lib/calendarMutation.js';
import { fixtureStore, call, ATHLETE, COACH, COACH_ACCOUNT } from './fixture-store.mjs';

const NOW=new Date('2026-10-10T12:00:00Z');
const entries=[];
function evidence(name,data){entries.push({name,...data});console.log(JSON.stringify({case:name,...data}));}
const source={
  id:'44444444-4444-4444-8444-444444444444',athlete_id:ATHLETE,coach_id:COACH,
  workout_date:'2026-10-05',sport:'run',title:'Trail climbs',description:'Controlled climbing session',
  structure:[{type:'work',repeat:4,duration_min:5,intensity:'z3',notes:'Hike steep grades'}],
  planned_duration_min:60,planned_distance_km:8,planned_distance_unit:'km',planned_tss:65,order_index:2,
  library_workout_id:'55555555-5555-4555-8555-555555555555',objective:'Efficient uphill movement',
  coach_instructions:'Keep descents easy; use poles on steep climbs',target_metric:'distance',planned_if:0.75,
  visibility:'coach_private',export_status:'exported',sync_provider:'fixture_provider',status:'completed',
  activity_match_mode:'manual',completed_activity_id:'66666666-6666-4666-8666-666666666666',
  completed_duration_min:55,completed_distance_km:7.8,athlete_rpe:6,athlete_comment:'Legs good',coach_feedback:'Good pacing',
};
const copyBody={action:'copy_week',athlete_id:ATHLETE,from_week_start:'2026-10-05',to_week_start:'2026-10-12'};
const handler=createPlannedWorkoutsHandler({fetchActivities:async()=>({activities:[],stravaConnected:false})});

test('real handler copies a prescription twice and loses fields, even with the same retry key',async()=>{
  const store=fixtureStore({planned_workouts:[source]});
  const body={...copyBody,client_request_id:'77777777-7777-4777-8777-777777777777'};
  const first=await call(handler,{method:'POST',body,actor:COACH_ACCOUNT,store});
  const second=await call(handler,{method:'POST',body,actor:COACH_ACCOUNT,store});
  assert.equal(first.status,200);assert.equal(second.status,200);
  const copies=store.tables.planned_workouts.filter(w=>w.workout_date==='2026-10-12');
  assert.equal(copies.length,2);assert.notEqual(copies[0].id,copies[1].id);
  for(const key of ['sport','title','description','structure','planned_duration_min','planned_distance_km','planned_distance_unit','planned_tss','order_index','library_workout_id']) assert.deepEqual(copies[0][key],source[key]);
  assert.equal(copies[0].objective,null);assert.equal(copies[0].coach_instructions,null);
  assert.equal(copies[0].target_metric,'duration');assert.equal(copies[0].planned_if,null);assert.equal(copies[0].visibility,'athlete_visible');
  assert.equal(copies[0].status,'planned');assert.equal(copies[0].completed_activity_id,null);
  evidence('copy-repeat',{verdict:'FAIL',responses:[first.status,second.status],targetRows:copies.length,source,firstCopy:copies[0],rawInsert:store.inserts[0].payload[0]});
});

test('actual calendar transport loses a successful copy response and retry adds another week',async(t)=>{
  const store=fixtureStore({planned_workouts:[source]});let requests=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const result=await call(handler,{method:options.method,body:JSON.parse(options.body),actor:COACH_ACCOUNT,store});
    if(++requests===1)throw new TypeError('simulated lost response AFTER handler commit');
    return Response.json(result.body,{status:result.status});
  });
  const lost=await calendarMutation('/api/planned-workouts',{body:copyBody});
  const retried=await calendarMutation('/api/planned-workouts',{body:copyBody});
  assert.equal(lost.ok,false);assert.equal(retried.ok,true);
  assert.equal(store.tables.planned_workouts.filter(w=>w.workout_date==='2026-10-12').length,2);
  evidence('copy-lost-response',{verdict:'FAIL',first:lost,retryOk:retried.ok,targetRows:2});
});

test('private source and default-visible clone are BOTH returned to the athlete by real GET handler',async()=>{
  const store=fixtureStore({planned_workouts:[source]});
  await call(handler,{method:'POST',body:copyBody,actor:COACH_ACCOUNT,store});
  const read=await call(handler,{query:{start:'2026-10-05',end:'2026-10-18'},store});
  assert.equal(read.status,200);assert.equal(read.body.workouts.length,2);
  assert.equal(read.body.workouts.find(w=>w.id===source.id).visibility,'coach_private');
  evidence('private-visibility',{verdict:'FAIL',athleteResponseStatus:read.status,athleteReceived:read.body.workouts.map(w=>({id:w.id,title:w.title,visibility:w.visibility,coach_instructions:w.coach_instructions}))});
});

test('relationship guard does prevent unlinked coach copying another athlete',async()=>{
  const store=fixtureStore({planned_workouts:[source],coach_athlete_relationships:[]});
  const result=await call(handler,{method:'POST',body:copyBody,actor:COACH_ACCOUNT,store});
  assert.equal(result.status,403);assert.equal(store.inserts.length,0);
  evidence('copy-relationship-guard',{verdict:'PASS',response:result});
});

test('private planning is accepted by real coach POST; athlete receives it without copying',async()=>{
  const store=fixtureStore();
  const body={...source,status:'planned',completed_activity_id:undefined,activity_match_mode:undefined,library_workout_id:undefined};
  const created=await call(handler,{method:'POST',body,actor:COACH_ACCOUNT,store});
  assert.equal(created.status,200);assert.equal(created.body.workout.visibility,'coach_private');
  const read=await call(handler,{query:{start:'2026-10-05',end:'2026-10-11'},store});
  assert.equal(read.status,200);assert.equal(read.body.workouts.length,1);
  assert.equal(read.body.workouts[0].coach_instructions,source.coach_instructions);
  evidence('private-create-to-athlete',{verdict:'FAIL',coachCreateStatus:created.status,athleteGetStatus:read.status,visibility:read.body.workouts[0].visibility,athleteReceivedInstructions:read.body.workouts[0].coach_instructions});
});

const recovery={id:'recovery',athlete_id:ATHLETE,date:'2026-10-10',inserted_at:'2026-10-10T10:00:00Z',intervention_type:'Foam Rolling',dose_duration:'30 min',subjective_feel:6};
const activity={id:'88888888-8888-4888-8888-888888888888',athlete_id:ATHLETE,start_date:'2026-10-10T09:00:00Z',local_date:'2026-10-10',sport_type:'Run',moving_time:3600,distance:10000,average_heartrate:140};
const manual={id:'99999999-9999-4999-8999-999999999999',athlete_id:ATHLETE,coach_id:null,workout_date:'2026-10-10',title:'Manual trail run',sport:'run',status:'completed',activity_match_mode:'manual',completed_duration_min:60,completed_distance_km:10,athlete_rpe:6,planned_tss:60};

test('real /api/me fixture matrix captures absence, manual, recovery, synced, matched and missing values',async(t)=>{
  const RealDate=Date;
  t.mock.method(globalThis,'Date',class extends RealDate{constructor(...args){super(...(args.length?args:[NOW.getTime()]));}static now(){return NOW.getTime();}});
  const cases=[
    {name:'no-activity',extra:{},load:0,verdict:'PASS'},
    {name:'manual-completion',extra:{planned_workouts:[manual]},load:0,verdict:'FAIL'},
    {name:'recovery-only',extra:{interventions:[recovery]},load:30,verdict:'FAIL'},
    {name:'one-synced-with-recovery',extra:{interventions:[recovery],strava_activities:[activity]},load:computeActivityTrimp(activity),verdict:'PASS'},
    {name:'matched-plan-and-activity',extra:{planned_workouts:[{...manual,activity_match_mode:'manual',completed_activity_id:activity.id}],strava_activities:[activity]},load:computeActivityTrimp(activity),verdict:'PASS'},
    {name:'manual-plus-synced-distinct',extra:{planned_workouts:[manual],strava_activities:[activity]},load:computeActivityTrimp(activity),verdict:'FAIL'},
    {name:'missing-duration-and-feel',extra:{interventions:[{...recovery,dose_duration:null,subjective_feel:null}]},load:0,verdict:'PASS'},
    {name:'missing-feel-with-duration',extra:{interventions:[{...recovery,subjective_feel:null}]},load:25,verdict:'FAIL'},
    {name:'string-feel-with-duration',extra:{interventions:[{...recovery,subjective_feel:'9'}]},load:25,verdict:'FAIL'},
    {name:'activity-missing-moving-time',extra:{strava_activities:[{...activity,moving_time:null}],interventions:[recovery]},load:30,verdict:'FAIL'},
    {name:'activity-missing-hr',extra:{strava_activities:[{...activity,average_heartrate:null}]},load:computeActivityTrimp({...activity,average_heartrate:null}),verdict:'PASS'},
  ];
  for(const item of cases){
    const store=fixtureStore(item.extra);const result=await call(meHandler,{store});
    assert.equal(result.status,200,item.name);
    const metrics=result.body.load_metrics;
    assert.equal(metrics.sparkline.at(-1).load,Number(item.load.toFixed(1)),item.name);
    assert.equal(store.queries.some(q=>q.table==='planned_workouts'),false,'/api/me never reads manual plans');
    evidence(item.name,{verdict:item.verdict,status:result.status,dayLoad:metrics.sparkline.at(-1).load,acute:metrics.acute,chronic:metrics.chronic,form:metrics.form,loadStatus:result.body.load_status,explainability:metrics.explainability,queriedTables:[...new Set(store.queries.map(q=>q.table))],calendarActuals:summarizeWeek(item.extra.planned_workouts||[])});
  }
});

test('manual completion is accepted by real POST and calendar shows actuals while /api/me stays zero',async(t)=>{
  const RealDate=Date;
  t.mock.method(globalThis,'Date',class extends RealDate{constructor(...args){super(...(args.length?args:[NOW.getTime()]));}static now(){return NOW.getTime();}});
  const store=fixtureStore();
  const created=await call(handler,{method:'POST',body:{...manual,client_request_id:manual.id},store});
  assert.equal(created.status,200);assert.equal(created.body.workout.status,'completed');
  const calendar=await call(handler,{query:{start:'2026-10-05',end:'2026-10-11'},store});
  const me=await call(meHandler,{store});
  const summary=summarizeWeek(calendar.body.workouts);
  assert.equal(summary.completedDurationMin,60);assert.equal(summary.completedDistanceKm,10);
  assert.equal(me.body.load_metrics.acute,0);assert.equal(me.body.load_metrics.chronic,0);
  evidence('manual-create-to-dashboard',{verdict:'FAIL',createStatus:created.status,calendarSummary:summary,dashboardMetrics:me.body.load_metrics,loadStatus:me.body.load_status});
});

test('pure domain edge cases: stale activity disables fallback, duplicate supplied activities double count',()=>{
  const old={...activity,start_date:'2026-01-01T09:00:00Z'};
  const stale=buildLoadMetrics({now:NOW,activities:[old],interventions:[recovery]});
  assert.equal(stale.sparkline.at(-1).load,0);
  const duplicates=buildLoadMetrics({now:NOW,activities:[activity,activity]});
  assert.equal(duplicates.sparkline.at(-1).load,Number((computeActivityTrimp(activity)*2).toFixed(1)));
  evidence('domain-input-edges',{staleDisablesFallback:stale.sparkline.at(-1).load,duplicateActivities:duplicates.sparkline.at(-1).load,verdict:'NOT REPRODUCED as normal /api/me duplicate',note:'Normal API date filter excludes stale rows, activity PK rejects duplicate row IDs; matched plan+activity case above counts once.'});
});

test.after(()=>writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify({revision:'fa8ebe2b377784007b4a40b4e982f92a11224075',now:NOW.toISOString(),cases:entries},null,2)));
