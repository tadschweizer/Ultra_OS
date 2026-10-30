import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const athlete='11111111-1111-4111-8111-111111111111',activity='66666666-6666-4666-8666-666666666666',plan='44444444-4444-4444-8444-444444444444';
const day=new Date().toLocaleDateString('en-CA'),revision='a'.repeat(32);
async function setup(page){
 const state={writes:[],fail:false,stale:false,failRead:false,marked:false,unit:'mi',calls:[],consumed:false};
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());let status=200,body={workouts:[],notes:[],events:[],comments:[],conversations:[],messages:[],settings:{}};
  if(url.pathname==='/api/me')body={athlete:{id:'22222222-2222-4222-8222-222222222222',name:'Synthetic coach',primary_role:'coach',onboarding_complete:true,subscription_tier:'coach_pro'},account:{primary_role:'coach',capabilities:{athlete:true,coach:true},coach_access:{eligible:true},coach_profile:{id:'33333333-3333-4333-8333-333333333333'}}};
  if(url.pathname==='/api/coach/relationships')body={relationships:[{athlete_id:athlete,status:'active',athlete:{name:'Synthetic runner'}}]};
  if(url.pathname==='/api/settings')body={settings:{distance_unit:state.unit}};
  if(url.pathname==='/api/planned-workouts'){
   const recording={id:activity,athlete_id:athlete,name:'Unassigned swim',sport:'swim',activity_date:day,duration_min:30,distance_km:1.5,source:'fixture'};
   body={workouts:state.consumed?[{id:plan,athlete_id:athlete,title:'Private linked plan',sport:'swim',workout_date:day,status:'completed',visibility:'coach_private',coach_id:'33333333-3333-4333-8333-333333333333',completed_activity_id:activity,structure:[]}]:[],
     activities:state.consumed?[]:[recording],match_activities:state.consumed?[{...recording,linked_workout_id:plan}]:[],import_source:{strava_connected:false}};
  }
  if(url.pathname==='/api/session-analysis')body={activity:{moving_time:1800,distance:1500},points:[],laps:[],availability:{status:'summary_only'},source:{label:'Fixture'},warnings:[]};
  if(url.pathname==='/api/workout-review'){
   state.calls.push(url.search);
   if(request.method()==='POST'){
    const operation=request.postDataJSON();state.writes.push(operation);
    if(state.fail){status=503;body={error:'Review temporarily unavailable'};}
    else if(state.stale){status=409;body={error:'The workout changed. Refresh the review before retrying.'};}
    else{state.marked=true;body={reviewed:true,revision};}
   }else if(state.failRead){status=503;body={error:'Refresh temporarily unavailable'};}
   else body={items:[...(state.marked?[]:[{id:activity,athlete_id:athlete,name:'Synthetic runner',title:'Unassigned swim',workout_date:day,status:'completed',source_kind:'activity',review_revision:revision,completed_duration_min:30,completed_distance_km:1.5}]),{id:plan,athlete_id:athlete,name:'Synthetic runner',title:'Completed assigned run',workout_date:day,source_kind:'workout',request_open:true}],has_more:false};
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });return state;
}

test('all-sport uploaded reviews link to recording details, preserve assigned links and require explicit acknowledgement',async({page})=>{
 const state=await setup(page);await page.goto('/coach/training-calendar');
 const queue=page.getByRole('region',{name:'Workouts to review'}),row=queue.getByRole('listitem').filter({hasText:'Unassigned swim'});
 await expect(row).toContainText('30 min · 0.93 mi');
 await expect(row.getByRole('link')).toHaveAttribute('href',`/coach/training-calendar?athlete=${athlete}&week=${day}&activity=${activity}`);
 await expect(queue.getByRole('link',{name:'Synthetic runner — Completed assigned run'})).toHaveAttribute('href',`/coach/training-calendar?athlete=${athlete}&week=${day}&workout=${plan}`);
 await row.getByRole('link').click();await expect(page.getByRole('dialog',{name:'Workout details'})).toBeVisible();expect(state.writes.length).toBe(0);
 await page.getByRole('dialog',{name:'Workout details'}).getByRole('button',{name:'Close',exact:true}).click();
 await row.getByRole('button',{name:'Reviewed — no change',exact:true}).click();
 await expect(row).toHaveCount(0);expect(state.writes.length).toBe(1);expect(state.writes[0].activity_id).toBe(activity);expect(state.writes[0].workout_id).toBeUndefined();
 await page.reload();await expect(queue.getByText('Unassigned swim',{exact:false})).toHaveCount(0);
 await page.screenshot({path:`output/uploaded-reviews/acknowledged-${test.info().project.name}.png`});
});

test('failed acknowledgement retries the same identity and stale results require refresh',async({page})=>{
 const state=await setup(page);state.fail=true;await page.goto('/coach/training-calendar');
 const queue=page.getByRole('region',{name:'Workouts to review'}),button=queue.getByRole('button',{name:'Reviewed — no change',exact:true});
 await button.click();await expect(queue.getByRole('alert')).toHaveText('Review temporarily unavailable');await expect(button).toBeEnabled();
 state.fail=false;state.stale=true;await button.click();await expect(queue.getByRole('alert')).toContainText('The workout changed');
 expect(state.writes[0].request_id).toBe(state.writes[1].request_id);await expect(button).toBeDisabled();
 state.stale=false;await queue.getByRole('button',{name:'Refresh reviews'}).click();await expect(button).toBeEnabled();await button.click();await expect(queue.getByText('Unassigned swim',{exact:false})).toHaveCount(0);
 expect(state.writes[2].request_id).not.toBe(state.writes[1].request_id);
});

test('uploaded recording consumed by a readable plan still opens directly from its review row',async({page})=>{
 const state=await setup(page);state.consumed=true;await page.goto('/coach/training-calendar');
 const row=page.getByRole('region',{name:'Workouts to review'}).getByRole('listitem').filter({hasText:'Unassigned swim'});
 await row.getByRole('link').click();
 const details=page.getByRole('dialog',{name:'Workout details'});await expect(details).toBeVisible();
 await expect(details.getByRole('heading',{name:'Unassigned swim',exact:true})).toBeVisible();
 expect(state.writes.length).toBe(0,'opening the underlying recording never matches or acknowledges it');
});

test('saved review remains acknowledged when background refresh fails, with read-only recovery',async({page})=>{
 const state=await setup(page);await page.goto('/coach/training-calendar');
 const queue=page.getByRole('region',{name:'Workouts to review'});await expect(queue.getByText('Unassigned swim',{exact:false})).toBeVisible();state.failRead=true;
 await queue.getByRole('button',{name:'Reviewed — no change',exact:true}).click();await expect(queue.getByRole('alert')).toHaveText('Refresh temporarily unavailable');
 await expect(queue.getByText('Unassigned swim',{exact:false})).toHaveCount(0);state.failRead=false;await queue.getByRole('button',{name:'Refresh reviews'}).click();await expect(queue.getByRole('alert')).toHaveCount(0);expect(state.writes.length).toBe(1);
});

test('queue uses kilometre preference and stays within a phone viewport',async({page})=>{
 const state=await setup(page);state.unit='km';await page.goto('/coach/training-calendar');
 const queue=page.getByRole('region',{name:'Workouts to review'});await expect(queue).toContainText('30 min · 1.5 km');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const accessibility=await new AxeBuilder({page}).include('[aria-label="Workouts to review"]').withTags(['wcag2a','wcag2aa']).analyze();
 expect(accessibility.violations).toEqual([]);
 await queue.screenshot({path:`output/uploaded-reviews/queue-${test.info().project.name}.png`});
});
