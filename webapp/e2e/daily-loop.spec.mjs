import { mockMessagingPersistence, clearMockDraft } from './helpers/message-drafts.mjs';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { decorateWorkoutsWithCompliance } from '../lib/workoutCompliance.js';

const athleteId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
async function setup(page, { coach = false } = {}) {
  const day = new Date().toLocaleDateString('en-CA');
  const state = { fail: false, writes: [], acknowledgements: [], messages: [], imported: [],
    workouts: [{ id: 'workout-1', title: 'Easy run', sport: 'run', workout_date: day, status: 'planned', activity_match_mode:'auto', updated_at:'2026-10-04T12:00:00Z', planned_duration_min: 60, planned_distance_unit: 'km', planned_distance_km: 10, structure: [] }] };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    const persistence = mockMessagingPersistence(request,state,coach?'coach':'athlete');
    if(persistence){await route.fulfill({status:persistence.status,contentType:'application/json',body:JSON.stringify(persistence.body)});return;}
    let status = 200; let data = { notes: [], events: [], comments: [], settings: {}, workouts: [], messages: [], conversations: [] };
    if (url.pathname === '/api/me') {
      state.meRequests=(state.meRequests || 0)+1;
      data = { athlete: { id: athleteId, name: 'QA athlete', onboarding_complete: true, subscription_tier: coach ? 'coach_pro' : 'free', primary_role: coach ? 'coach' : 'athlete' }, account: { primary_role: coach ? 'coach' : 'athlete', capabilities: { athlete: true, coach }, coach_access:{eligible:coach} },...(state.loadMetrics?{load_metrics:state.loadMetrics}:{}) };
    }
    if (url.pathname === '/api/coach/relationships') data = {relationships:[{athlete_id:athleteId,status:'active',athlete:{name:'First athlete'}}]};
    if (url.pathname === '/api/planned-workouts') {
      if (request.method() === 'GET') {
        const workouts = decorateWorkoutsWithCompliance(state.workouts,state.imported,{toleranceDays:1});
        const consumed = new Set(workouts.map(w=>String(w.completed_activity_id || w.matched_activity?.id || '')));
        const activities = state.imported.map(a=>({ ...a,activity_date:a.local_date,duration_min:a.moving_time == null ? null : a.moving_time/60,distance_km:a.distance == null ? null : a.distance/1000 }));
        data = {workouts,activities:activities.filter(a=>!consumed.has(String(a.id))),match_activities:activities.map(a=>({...a,linked_workout_id:state.workouts.find(w=>w.completed_activity_id===a.id)?.id||null}))};
      }
      else {
        const body = request.postDataJSON(); state.writes.push(body);
        if (state.fail) { status = 503; data = { error: 'Save unavailable. Please retry.' }; }
        else if (request.method() === 'PATCH') {
          const workout=state.workouts.find(w=>w.id===body.id);
          if(body.match_action) {
            if(body.match_action==='confirm') {
              const a=state.imported.find(a=>a.id===body.activity_id);
              Object.assign(workout,{status:'completed',activity_match_mode:'manual',completed_activity_id:a.id,completed_duration_min:a.moving_time==null?null:a.moving_time/60,completed_distance_km:a.distance==null?null:a.distance/1000});
            } else Object.assign(workout,{status:'planned',activity_match_mode:body.match_action==='auto'?'auto':'manual',completed_activity_id:null,completed_duration_min:null,completed_distance_km:null});
          } else Object.assign(workout,body);
          workout.updated_at=new Date().toISOString(); data={workout};
          if(state.completionLoad)state.loadMetrics=state.completionLoad;
          if(state.loseNextResponse) {state.loseNextResponse=false;await route.abort('failed');return;}
        }
        else { const workout = { ...body, id: 'new-workout' }; state.workouts.push(workout); data = { workout }; }
      }
    }
    if (url.pathname === '/api/coach/messages') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); state.writes.push(body);
        if (state.fail) { status=503; data={error:'Unavailable'}; }
        else { const message = { id: body.client_message_id, athlete_id: body.athlete_id || athleteId, sender_role: coach ? 'coach' : 'athlete', message_body: body.message_body, created_at: new Date().toISOString() }; state.messages.push(message); clearMockDraft(state,coach?'coach':'athlete',body.athlete_id || athleteId,body); data={message}; }
      } else data = { role: coach ? 'coach' : 'athlete', templates: { general_checkin: 'How are you?' }, conversations: [
        { athlete_id: athleteId, athlete: { name: 'First athlete' }, unread_count: 1 },
        ...(coach ? [{ athlete_id: secondId, athlete: { name: 'Second athlete' }, unread_count: 0 }] : []),
      ], messages: url.searchParams.has('before') ? state.older || [] : state.messages.filter(m => m.athlete_id === (url.searchParams.get('athlete_id') || athleteId)), next_cursor: state.older?.length && !url.searchParams.has('before') ? 'older-page' : null };
    }
    if (url.pathname === '/api/message-center') {
      if (request.method() === 'POST') { state.acknowledgements.push(request.postDataJSON()); data={success:true}; }
      else data={has_messaging:true,role:coach?'coach':'athlete',unread_total:1,workout_threads:[],conversations:[{athlete_id:athleteId,name:'First athlete',unread:1}]};
    }
    await route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) });
  });
  return state;
}

test('completion keeps unknown actuals blank, recovers from failure, permits correction and undo', async ({ page }, info) => {
  const state = await setup(page); await page.goto('/calendar?workout=workout-1');
  const dialog = page.getByRole('dialog', { name:'Workout details' });
  await expect(dialog).toBeVisible();
  const accessibility=await new AxeBuilder({ page }).include('[aria-label="Workout details"]').withTags(['wcag2a','wcag2aa']).disableRules(['color-contrast']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({path:`../output/p0-daily-loop-${info.project.name}.png`});
  await expect(dialog.getByLabel('Actual duration in minutes')).toHaveValue('');
  await expect(dialog.getByLabel('Actual distance in km')).toHaveValue('');
  await expect(dialog.getByText('Imported activity match',{exact:true})).toHaveCount(0);
  await dialog.getByLabel('Actual duration in minutes').fill('20');
  state.fail = true; await dialog.getByRole('button',{name:'Mark completed',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Save unavailable');
  await expect(dialog.getByLabel('Actual duration in minutes')).toHaveValue('20');
  state.fail = false; await dialog.getByRole('button',{name:'Mark completed',exact:true}).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved.');
  expect(state.workouts[0].completed_distance_km).toBeNull();
  await dialog.getByLabel('Actual duration in minutes').fill('25');
  await dialog.getByRole('button',{name:'Save correction',exact:true}).click();
  await expect.poll(()=>state.workouts[0].completed_duration_min).toBe(25);
  await dialog.getByRole('button',{name:'Undo completion / skip'}).click();
  await expect.poll(()=>state.workouts[0].status).toBe('planned');
  expect(state.workouts[0].completed_duration_min).toBeNull();
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('athlete can log an unplanned workout from the mobile entry point', async ({ page }) => {
  const state=await setup(page); await page.goto('/calendar?log=1');
  const dialog=page.getByRole('dialog',{name:'Workout editor'});
  await dialog.getByLabel('Workout title',{exact:true}).fill('Lunch walk');
  await dialog.getByLabel('Actual duration (min)',{exact:true}).fill('18');
  await dialog.getByRole('button',{name:'Save completed workout'}).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0].status).toBe('completed'); expect(state.writes[0].completed_duration_min).toBe(18);
  expect(state.writes[0].planned_duration_min).toBeNull();
});

test('recipient drafts stay separate and failed retries reuse the same message identity', async ({ page }) => {
  const state=await setup(page,{coach:true}); await page.goto('/messages');
  await page.getByLabel('Your message').fill('First draft');
  await page.getByLabel('Selected athlete').selectOption(secondId);
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await page.getByLabel('Your message').fill('Second draft');
  await page.getByLabel('Selected athlete').selectOption(athleteId);
  await expect(page.getByLabel('Your message')).toHaveValue('First draft');
  state.fail=true; await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Unable to send');
  state.fail=false; await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByLabel('Your message')).toHaveValue('');
  expect(state.writes[0].client_message_id).toBe(state.writes[1].client_message_id);
  expect(state.messages).toHaveLength(1);
});

test('incoming reply refreshes without reload and acknowledges only the displayed messages', async ({ page }) => {
  const state=await setup(page,{coach:true}); await page.goto('/messages');
  await expect(page.getByLabel('Selected athlete')).toHaveValue(athleteId);
  state.messages.push({id:messageId, athlete_id:athleteId, sender_role:'athlete',message_body:'Legs feel good today',created_at:new Date().toISOString()});
  await expect(page.getByText('Legs feel good today',{exact:true})).toBeVisible({timeout:6500});
  await expect.poll(()=>state.acknowledgements.some(a=>a.message_ids?.includes(messageId))).toBe(true);
  expect(state.acknowledgements.at(-1).message_ids).toEqual([messageId]);
});

test('floating conversation opens the canonical inbox with the selected recipient', async ({ page }) => {
  await setup(page,{coach:true}); await page.goto('/calendar');
  await page.getByRole('button',{name:/Messages \(1 unread\)/}).click();
  await page.getByRole('button',{name:/First athlete/}).click();
  await expect(page).toHaveURL(new RegExp(`/messages\\?athlete_id=${athleteId}`));
  await expect(page.getByLabel('Selected athlete')).toHaveValue(athleteId);
});


test('older history remains visible after automatic refresh', async ({ page }) => {
  const state=await setup(page,{coach:true});
  state.messages=[{id:messageId,athlete_id:athleteId,sender_role:'coach',message_body:'Recent reply',created_at:'2026-10-04T12:00:00Z'}];
  state.older=[{id:'older',athlete_id:athleteId,sender_role:'coach',message_body:'Older training discussion',created_at:'2026-09-01T12:00:00Z'}];
  await page.goto('/messages');
  await page.getByRole('button',{name:'Load older messages'}).click();
  await expect(page.getByText('Older training discussion',{exact:true})).toBeVisible();
  state.messages.push({id:'latest',athlete_id:athleteId,sender_role:'athlete',message_body:'New while reading history',created_at:'2026-10-04T13:00:00Z'});
  await expect(page.getByText('New while reading history',{exact:true})).toBeVisible({timeout:6500});
  await expect(page.getByText('Older training discussion',{exact:true})).toBeVisible();
});

test('Today exposes planned training and coach feedback; phone navigation opens logging', async ({ page }, info) => {
  const state=await setup(page);
  state.messages=[{id:messageId,athlete_id:athleteId,sender_role:'coach',message_body:'Keep the run relaxed today.',created_at:new Date().toISOString()}];
  await page.goto('/dashboard');
  const today=page.getByRole('region',{name:"Today's training"});
  await expect(today.getByText('Easy run',{exact:true})).toBeVisible();
  await expect(today.getByText('Keep the run relaxed today.')).toBeVisible();
  if(info.project.name==='mobile-chromium') {
    const nav=page.getByRole('navigation',{name:'Primary navigation'});
    for(const name of ['Today','Calendar','Log workout','Messages','Profile']) await expect(nav.getByRole('link',{name,exact:true})).toBeVisible();
    await nav.getByRole('link',{name:'Log workout',exact:true}).click();
  } else await today.getByRole('link',{name:'Log workout'}).click();
  const dialog=page.getByRole('dialog',{name:'Workout editor'});
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
});

const firstActivity = '55555555-5555-4555-8555-555555555555';
const secondActivity = '66666666-6666-4666-8666-666666666666';
function addImported(state) {
  state.imported = [
    {id:firstActivity,name:'Morning run',sport_type:'Run',local_date:state.workouts[0].workout_date,start_date:`${state.workouts[0].workout_date}T12:00:00Z`,moving_time:3600,distance:10000},
    {id:secondActivity,name:'Evening run',sport_type:'Run',local_date:state.workouts[0].workout_date,start_date:`${state.workouts[0].workout_date}T18:00:00Z`,moving_time:2400,distance:0},
  ];
}

test('athlete rejects an automatic match, refreshes, and explicitly restores automatic matching', async ({page}) => {
  const state=await setup(page); addImported(state);
  await page.goto('/calendar?workout=workout-1');
  let dialog=page.getByRole('dialog',{name:'Workout details'});
  await expect(dialog.getByText(/Suggested match to an imported activity/)).toBeVisible();
  await dialog.getByRole('button',{name:'Reject suggested match'}).click();
  await expect(dialog.getByText('Not completed yet.')).toBeVisible();
  await expect(dialog.getByText(/Automatic matching is off/)).toBeVisible();
  await expect(dialog.getByLabel('Actual duration in minutes')).toHaveValue('');
  await page.reload(); dialog=page.getByRole('dialog',{name:'Workout details'});
  await expect(dialog.getByText('Not completed yet.')).toBeVisible();
  await dialog.getByRole('button',{name:'Use automatic matching'}).click();
  await expect(dialog.getByText(/Suggested match to an imported activity/)).toBeVisible();
  await expect(dialog.getByLabel('Actual duration in minutes')).toHaveValue('60');
  await expect(dialog.getByLabel('Choose an imported activity')).toHaveValue(firstActivity);
  expect(state.workouts[0].activity_match_mode).toBe('auto');
});

test('athlete replaces a suggested match, retains failed selection, confirms, reloads, then unlinks', async ({page},info) => {
  const state=await setup(page); addImported(state);
  await page.goto('/calendar?workout=workout-1');
  const dialog=page.getByRole('dialog',{name:'Workout details'});
  await dialog.getByLabel('Choose an imported activity').selectOption(secondActivity);
  state.fail=true;
  await dialog.getByRole('button',{name:'Confirm activity match'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Save unavailable');
  await expect(dialog.getByLabel('Choose an imported activity')).toHaveValue(secondActivity);
  state.fail=false;
  await dialog.getByRole('button',{name:'Confirm activity match'}).click();
  await expect(dialog.getByText('Confirmed imported activity.',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Actual duration in minutes')).toHaveValue('40');
  await expect(dialog.getByLabel('Actual distance in km')).toHaveValue('0');
  expect(state.workouts[0].completed_activity_id).toBe(secondActivity);
  const accessibility=await new AxeBuilder({page}).include('[aria-label="Workout details"]').withTags(['wcag2a','wcag2aa']).disableRules(['color-contrast']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({path:`../output/p0-workout-match-${info.project.name}.png`});
  await page.reload();
  await expect(dialog.getByText('Confirmed imported activity.',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Unlink activity'}).click();
  await expect(dialog.getByText('Not completed yet.')).toBeVisible();
  await page.reload(); await expect(dialog.getByText(/Automatic matching is off/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('confirmed match survives a lost response and a retry of the same selection', async ({page}) => {
  const state=await setup(page); addImported(state); state.loseNextResponse=true;
  await page.goto('/calendar?workout=workout-1');
  const dialog=page.getByRole('dialog',{name:'Workout details'});
  await dialog.getByRole('button',{name:'Confirm activity match'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Connection lost');
  await expect(dialog.getByLabel('Choose an imported activity')).toHaveValue(firstActivity);
  await dialog.getByRole('button',{name:'Confirm activity match'}).click();
  await expect(dialog.getByText('Confirmed imported activity.',{exact:true})).toBeVisible();
  expect(state.writes[0].activity_id).toBe(state.writes[1].activity_id);
  expect(state.writes[0].expected_updated_at).toBe(state.writes[1].expected_updated_at);
});

test('coach can inspect a suggested match but athlete match controls stay absent', async ({page}) => {
  const state=await setup(page,{coach:true}); addImported(state);
  await page.goto(`/coach/training-calendar?athlete=${athleteId}&workout=workout-1`);
  const dialog=page.getByRole('dialog',{name:'Workout details'});
  await expect(dialog.getByText(/Suggested match to an imported activity/)).toBeVisible();
  await expect(dialog.getByLabel('Choose an imported activity')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Confirm activity match'})).toHaveCount(0);
});

test('triage template opens once and does not refill the composer after sending', async ({ page }) => {
  await setup(page, { coach: true });
  await page.goto(`/messages?athlete_id=${athleteId}&template_key=general_checkin`);
  await expect(page.getByLabel('Your message')).toHaveValue('How are you?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('How are you?', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your message')).toHaveValue('');
});

test('reviewed native callback refreshes shared athlete load after accepted completion',async({page},info)=>{
  const state=await setup(page);state.loadMetrics={chronic:0,acute:0,form:0};state.completionLoad={chronic:125,acute:135,form:-10};
  if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:900});
  await page.goto('/calendar?workout=workout-1');const details=page.getByRole('dialog',{name:'Workout details'});
  await details.getByLabel('Actual duration in minutes').fill('25');
  const before=state.meRequests;await details.getByRole('button',{name:'Mark completed',exact:true}).click();
  await expect.poll(()=>state.meRequests).toBeGreaterThan(before);
  await expect(page.getByText('Fitness (CTL)',{exact:true}).locator('..')).toContainText('125');
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('threshold.me.v1')).load_metrics.chronic)).toBe(125);
  await page.screenshot({path:`../output/review-transfer-native-load-${info.project.name}.png`});
});

// Frontend protocol fixture; actual atomic copy/private/load handlers remain
// in PR136 and were independently accepted in b10c309. No real API/provider.
test('reviewed copy retry survives reload, releases confirmed key before GET failure and isolates actors',async({page},info)=>{
  test.setTimeout(60000);if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:900});
  const day=new Date().toISOString().slice(0,10),requests=[],receipts=new Map(),external=[];
  let actor=messageId,lost=true,failRefresh=false;
  const source={id:'copy-source',title:'Scoped trail session',workout_date:day,sport:'run',status:'planned',planned_duration_min:40,structure:[]};
  page.on('request',r=>{if(!['127.0.0.1','localhost'].includes(new URL(r.url()).hostname))external.push(r.url());});
  await page.route('**/api/**',async route=>{
    const req=route.request(),u=new URL(req.url());let result={notes:[],events:[],workouts:[],comments:[],settings:{},notifications:[],unreadCount:0};
    if(u.pathname==='/api/me')result={athlete:{id:actor,name:'Isolated coach',onboarding_complete:true,primary_role:'coach',subscription_tier:'coach_pro'},account:{primary_role:'coach',capabilities:{athlete:true,coach:true},coach_access:{eligible:true},coach_profile:{id:'isolated-profile'}}};
    if(u.pathname==='/api/coach/relationships')result={relationships:[{athlete_id:athleteId,status:'active',athlete:{name:'Isolated trail runner'}}]};
    if(u.pathname==='/api/planned-workouts'){
      if(req.method()==='GET'){
        if(failRefresh){failRefresh=false;return route.fulfill({status:503,json:{error:'Isolated GET failure after confirmed copy'}});}
        result={workouts:[source],activities:[],match_activities:[]};
      }else{
        const body=req.postDataJSON();requests.push({actor,...body});
        const key=actor+':'+body.client_request_id;const replayed=receipts.has(key);
        receipts.set(key,body);result={workouts:[{...source,id:'isolated-copy-'+receipts.size,workout_date:body.to_week_start}],replayed};
        if(lost){lost=false;return route.abort('failed');}
      }
    }
    await route.fulfill({status:200,json:result});
  });
  const copies=page.getByRole('button',{name:'Copy week to next week',exact:true});
  await page.goto(`/coach/training-calendar?athlete=${athleteId}`);await copies.first().click();
  await expect(page.getByText(/Connection lost/)).toBeVisible();const first=requests[0].client_request_id;
  await page.reload();await expect(copies.first()).toBeVisible();failRefresh=true;await copies.first().click();
  await expect(page.getByText('Isolated GET failure after confirmed copy',{exact:true})).toBeVisible();
  expect(requests[1].client_request_id).toBe(first);expect(receipts.size).toBe(1);
  await page.reload();await copies.first().click();await expect.poll(()=>requests.length).toBe(3);
  expect(requests[2].client_request_id).not.toBe(first);expect(receipts.size).toBe(2);
  // An uncertain operation for actor A must not become actor B's retry key.
  lost=true;await copies.first().click();await expect(page.getByText(/Connection lost/)).toBeVisible();const uncertain=requests[3].client_request_id;
  actor=secondId;await page.evaluate(id=>sessionStorage.setItem('threshold.me.v1',JSON.stringify({athlete:{id,onboarding_complete:true,primary_role:'coach',subscription_tier:'coach_pro'},account:{primary_role:'coach',capabilities:{athlete:true,coach:true},coach_access:{eligible:true}}})),actor);
  await page.reload();await copies.first().click();await expect.poll(()=>requests.length).toBe(5);
  expect(requests[4].client_request_id).not.toBe(uncertain);expect(requests[4].actor).toBe(secondId);expect(external).toEqual([]);
  await page.screenshot({path:`../output/review-transfer-native-copy-${info.project.name}.png`});
});
