import {test,expect} from '@playwright/test';

const athlete='11111111-1111-4111-8111-111111111111',coach='33333333-3333-4333-8333-333333333333',workoutId='44444444-4444-4444-8444-444444444444';
const day=new Date().toLocaleDateString('en-CA');
async function setup(page,{role='coach'}={}){
  const state={rosterFail:false,publishFail:true,reviewFail:false,writes:[],replyCount:0,receipts:new Map(),review:{revision:1,reviewed:false,request_open:true},
    workouts:[{id:workoutId,athlete_id:athlete,coach_id:coach,title:'Easy run',sport:'run',workout_date:day,status:'completed',visibility:'athlete_visible',updated_at:'2026-10-16T12:00:00Z',structure:[],planned_duration_min:40,planned_distance_unit:'km',completed_duration_min:null,completed_distance_km:null,athlete_comment:'Felt tired',athlete_rpe:6}],
    relationships:Array.from({length:5},(_,i)=>({athlete_id:i===0?athlete:`22222222-2222-4222-8222-22222222222${i}`,status:'active',athlete:{name:`Runner ${i+1}`}}))};
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());let status=200,data={workouts:[],notes:[],events:[],comments:[],settings:{},conversations:[],messages:[]};
    if(url.pathname==='/api/me')data={athlete:{id:role==='coach'?'99999999-9999-4999-8999-999999999999':athlete,name:'QA',onboarding_complete:true,subscription_tier:role==='coach'?'coach_pro':'core',primary_role:role},account:{primary_role:role,capabilities:{athlete:true,coach:role==='coach'},coach_access:{eligible:role==='coach'},coach_profile:{id:coach}}};
    if(url.pathname==='/api/coach/relationships'){status=state.rosterFail?503:200;data={relationships:state.relationships};}
    if(url.pathname==='/api/workout-library')data={workouts:[{id:'55555555-5555-4555-8555-555555555555',name:'Easy library run',sport:'run',structure:[],planned_duration_min:40,planned_distance_unit:'km',updated_at:'2026-10-16T12:00:00Z'}]};
    if(url.pathname==='/api/planned-workouts'){
      if(req.method()==='PATCH'){const body=req.postDataJSON();state.writes.push(body);if(state.failSave){status=503;data={error:'Adjustment save failed'};}else{Object.assign(state.workouts.find(w=>w.id===body.id),body);data={workout:state.workouts.find(w=>w.id===body.id)};}}
      else data={workouts:state.workouts,activities:[],match_activities:[],import_source:{strava_connected:false}};
    }
    if(url.pathname==='/api/coach/weekly-plan'){
      if(req.method()==='GET')data={workouts:[],sources:state.workouts};
      else{const body=req.postDataJSON();state.writes.push(body);if(state.publishFail&&body.athlete_id===state.relationships[1].athlete_id){status=503;data={error:'Temporary failure for Runner 2'};}
        else{if(!state.receipts.has(body.request_id))state.receipts.set(body.request_id,{workout_ids:[crypto.randomUUID()]});data=state.receipts.get(body.request_id);}}
    }
    if(url.pathname==='/api/workout-review'){
      if(req.method()==='GET')data=url.searchParams.has('workout_id')?state.review:{items:[{...state.workouts[0],name:'Runner 1',request_open:state.review.request_open}],has_more:false};
      else{const body=req.postDataJSON();if(state.reviewFail){status=503;data={error:'Save unavailable'};}else{
        if(body.action==='reply'){state.replyCount++;state.review={...state.review,reviewed:true,request_open:false};}
        if(body.action==='review')state.review={...state.review,reviewed:true};
        if(body.action==='request')state.review={...state.review,request_open:true,revision:state.review.revision+1};data=state.review;}}
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });return state;
}

test('weekly planning: five athletes, individual editor, partial retry survives reload',async({page})=>{
 const state=await setup(page);await page.goto('/coach/training-calendar');
 await page.getByRole('button',{name:'Plan week',exact:true}).click();await page.getByLabel('Destination week starts').fill(day);
 for(let i=1;i<=5;i++)await page.getByLabel(`Runner ${i}`,{exact:true}).check();
 await page.getByRole('button',{name:'Choose library workouts'}).click();await page.getByLabel('Easy library run',{exact:true}).check();
 await page.getByRole('button',{name:'Preview each athlete'}).click();
 await page.getByRole('button',{name:'Edit Runner 1 workout 1'}).click();
 const editor=page.getByRole('dialog',{name:'Workout editor'});await expect(editor).toBeVisible();
 await editor.getByPlaceholder('Workout title').fill('Runner 1 easy run');await editor.getByRole('button',{name:'Save workout',exact:true}).click();
 for(let i=1;i<=5;i++)await page.getByLabel(`I checked dates, instructions and individual targets for Runner ${i}; no automatic rescaling`).check();
 await page.getByRole('button',{name:'Publish week',exact:true}).click();
 await expect(page.getByText('Published 1 workouts.')).toHaveCount(4);
 await expect(page.getByText('Temporary failure for Runner 2')).toBeVisible();expect(state.receipts.size).toBe(4);
 await page.reload();await expect(page.getByText('Published 1 workouts.')).toHaveCount(4);
 state.publishFail=false;await page.getByRole('button',{name:'Retry unconfirmed athletes'}).click();
 await expect(page.getByText('Published 1 workouts.')).toHaveCount(5);expect(state.receipts.size).toBe(5);
 expect(state.writes.filter(w=>w.athlete_id===athlete&&w.entries).length).toBe(1);
 expect(state.writes.find(w=>w.entries)?.entries[0].prescription.title).toBe('Runner 1 easy run');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('review: no-change keeps request, reply draft survives reload and failed save',async({page})=>{
 const state=await setup(page);await page.goto(`/coach/training-calendar?athlete=${athlete}&week=${day}&workout=${workoutId}`);
 const panel=page.getByRole('region',{name:'Session review'});await expect(panel.getByText('Awaiting coach review.',{exact:false})).toBeVisible();
 await panel.getByRole('button',{name:'Reviewed — no change'}).click();await expect(panel.getByText('Coach reviewed this result.',{exact:false})).toBeVisible();expect(state.review.request_open).toBe(true);
 await panel.getByLabel('Review reply').fill('Keep tomorrow easy.');await page.reload();await expect(panel.getByLabel('Review reply')).toHaveValue('Keep tomorrow easy.');
 state.reviewFail=true;await panel.getByRole('button',{name:'Send reply and review'}).click();await expect(panel.getByRole('alert')).toHaveText('Save unavailable');
 await page.reload();state.reviewFail=false;await panel.getByRole('button',{name:'Retry unconfirmed review action'}).click();await expect(panel.getByLabel('Review reply')).toHaveValue('');expect(state.replyCount).toBe(1);
 await expect(page.getByRole('dialog',{name:'Workout details'}).getByText('Duration unknown',{exact:false})).toBeVisible();
 await page.screenshot({path:`output/weekly-workflow/review-${test.info().project.name}.png`});
});

test('athlete draft survives reload and explicit request is separate from completion',async({page})=>{
 const state=await setup(page,{role:'athlete'});await page.goto(`/calendar?week=${day}&workout=${workoutId}`);
 await page.getByLabel('Workout notes').fill('Please check tomorrow');await page.reload();await expect(page.getByLabel('Workout notes')).toHaveValue('Please check tomorrow');
 await expect(page.getByRole('button',{name:'Ask coach to respond'})).toBeDisabled();
 await page.getByRole('button',{name:'Save feedback only',exact:true}).click();
 await page.getByRole('button',{name:'Ask coach to respond'}).click();await expect.poll(()=>state.review.revision).toBe(2);
 expect(state.writes.length).toBe(1);expect(state.writes[0].status).toBeUndefined();expect(state.writes[0].completed_activity_id).toBeUndefined();
});

test('adjust upcoming session saves separately, keeps stale-edit token and survives failure',async({page})=>{
 const state=await setup(page);const nextId='66666666-6666-4666-8666-666666666666';
 const nextDay=new Date(Date.parse(`${day}T12:00:00Z`)+86400000).toISOString().slice(0,10);
 state.workouts.push({...state.workouts[0],id:nextId,workout_date:nextDay,title:'Tomorrow run',status:'planned',athlete_comment:null,athlete_rpe:null});
 await page.goto(`/coach/training-calendar?athlete=${athlete}&week=${day}&workout=${workoutId}`);
 await page.getByRole('button',{name:'Adjust upcoming session',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Workout editor'});await editor.getByPlaceholder('Workout title').fill('Tomorrow recovery');
 state.failSave=true;await editor.getByRole('button',{name:'Save workout',exact:true}).click();await expect(editor.getByRole('status')).toHaveText('Adjustment save failed');
 expect(state.workouts[1].title).toBe('Tomorrow run');expect(state.review.reviewed).toBe(false);
 state.failSave=false;await editor.getByRole('button',{name:'Save workout',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Workout details'})).toContainText('Upcoming session saved. Finish reviewing this result');
 expect(state.workouts[1].title).toBe('Tomorrow recovery');
 expect(state.writes.at(-1).expected_updated_at).toBe('2026-10-16T12:00:00Z');expect(state.writes.at(-1).status).toBeUndefined();
 await expect(page).toHaveURL(new RegExp(`workout=${workoutId}`));
 await page.getByRole('button',{name:'Reviewed — no change'}).click();await expect.poll(()=>state.review.reviewed).toBe(true);
});

test('roster failure is recoverable and not an empty roster',async({page})=>{
 const state=await setup(page);state.rosterFail=true;await page.goto('/coach/training-calendar');
 await expect(page.getByText('Could not load your athletes. Please retry.')).toBeVisible();await expect(page.getByText('No active athletes yet.')).toHaveCount(0);
 state.rosterFail=false;await page.getByRole('button',{name:'Retry roster'}).click();await expect(page.getByRole('combobox').first()).toBeVisible();
});
